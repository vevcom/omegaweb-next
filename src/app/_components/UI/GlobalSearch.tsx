'use client'
import ModeSwitch from './ModeSwitch'
import Image from '@/components/Image/Image'
import useKeyPress from '@/hooks/useKeyPress'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import { useDebounce } from '@/hooks/useDebounce'
import { searchEventsAction } from '@/services/events/actions'
import { searchUsersAction } from '@/services/users/actions'
import { userAuth } from '@/services/users/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useGlobalSearch } from '@/contexts/GlobalSearch'
import { formatVevenUri } from '@/lib/urlEncoding'
import { displayDate } from '@/lib/dates/displayDate'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faCalendar, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ChangeEvent, KeyboardEvent } from 'react'
import type { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import type { NavLink } from '@/components/NavBar/navDef'
import type { ExpandedImage } from '@/services/images/subservice/types'

type Category = 'all' | 'navigation' | 'users' | 'events'

type Thumb =
    | { type: 'icon', icon: IconDefinition }
    | { type: 'image', image: ExpandedImage }

type SearchItem = {
    key: string,
    href: string,
    thumb: Thumb,
    label: string,
    sublabel?: string,
}

type SearchSection = {
    label: string,
    items: SearchItem[],
}

export type PropTypes = {
    /** The nav items the session may open, as `visibleNavItems` leaves them. */
    navItems: NavLink[],
}

const categoryOptions: { value: Category, label: string }[] = [
    { value: 'all', label: 'Alt' },
    { value: 'navigation', label: 'Navigasjon' },
    { value: 'users', label: 'Brukere' },
    { value: 'events', label: 'Arrangementer' },
]

const kbdClassName = [
    'inline-flex items-center justify-center min-w-4 py-[calc(0.15*var(--gap))] px-[calc(0.4*var(--gap))]',
    'mr-[calc(0.3*var(--gap))] bg-surface-hover rounded-[calc(0.35*var(--gap))] text-s text-text',
].join(' ')

/**
 * Global command-K search popup, inspired by JetBrains' "Search Everywhere": a single box
 * that searches site navigation, users and events at once, grouped into tabs the user can
 * cycle through with Tab/Shift+Tab and browse with the arrow keys.
 */
export default function GlobalSearch({ navItems }: PropTypes) {
    const canSearchUsers = useAuthorizer({ authorizer: userAuth.search }).authorized
    const availableCategories = canSearchUsers
        ? categoryOptions
        : categoryOptions.filter(option => option.value !== 'users')

    const { isOpen, setIsOpen } = useGlobalSearch()
    const [category, setCategory] = useState<Category>('all')
    const [query, setQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [activeIndex, setActiveIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [userResults, setUserResults] = useState<
        { id: number, username: string, firstname: string, lastname: string, image: ExpandedImage }[]
    >([])
    const [eventResults, setEventResults] = useState<
        { id: number, name: string, eventStart: Date, coverImage: { image: ExpandedImage | null } }[]
    >([])

    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()
    const updateDebouncedQuery = useDebounce((value: string) => setDebouncedQuery(value), 300)

    const close = () => {
        setIsOpen(false)
        setCategory('all')
        setQuery('')
        setDebouncedQuery('')
        setActiveIndex(0)
        setUserResults([])
        setEventResults([])
    }
    const ref = useClickOutsideRef(close)
    useKeyPress('Escape', close)

    useEffect(() => {
        const handleShortcut = (event: globalThis.KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setIsOpen(previousOpen => !previousOpen)
            }
        }
        window.addEventListener('keydown', handleShortcut)
        return () => window.removeEventListener('keydown', handleShortcut)
    }, [setIsOpen])

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus()
        }
    }, [isOpen])

    useEffect(() => {
        if (!debouncedQuery) return undefined

        let cancelled = false
        const limit = category === 'all' ? undefined : 20

        void Promise.all([
            canSearchUsers ? searchUsersAction({ params: { query: debouncedQuery, limit } }) : null,
            searchEventsAction({ params: { query: debouncedQuery, limit } }),
        ]).then(([usersResult, eventsResult]) => {
            if (cancelled) return
            setUserResults(usersResult?.success ? usersResult.data : [])
            setEventResults(eventsResult.success ? eventsResult.data : [])
            setLoading(false)
        })

        return () => {
            cancelled = true
        }
    }, [debouncedQuery, category, canSearchUsers])

    const trimmedQuery = query.trim().toLowerCase()

    const navSectionItems: SearchItem[] = useMemo(() => navItems
        .filter(item => trimmedQuery === '' || item.name.toLowerCase().includes(trimmedQuery))
        .map(item => ({
            key: `nav-${item.href}`,
            href: item.href,
            thumb: { type: 'icon', icon: item.icon },
            label: item.name,
        })),
    [navItems, trimmedQuery])

    const userSectionItems: SearchItem[] = useMemo(() => userResults.map(user => ({
        key: `user-${user.id}`,
        href: `/users/${user.username}`,
        thumb: { type: 'image', image: user.image },
        label: `${user.firstname} ${user.lastname}`,
        sublabel: `@${user.username}`,
    })), [userResults])

    const eventSectionItems: SearchItem[] = useMemo(() => eventResults.map(event => ({
        key: `event-${event.id}`,
        href: `/events/${formatVevenUri(event.name, event.id)}`,
        thumb: event.coverImage.image
            ? { type: 'image', image: event.coverImage.image }
            : { type: 'icon', icon: faCalendar },
        label: event.name,
        sublabel: displayDate(new Date(event.eventStart), false),
    })), [eventResults])

    const sections: SearchSection[] = useMemo(() => {
        if (category === 'navigation') return [{ label: 'Navigasjon', items: navSectionItems }]
        if (category === 'users') return [{ label: 'Brukere', items: userSectionItems }]
        if (category === 'events') return [{ label: 'Arrangementer', items: eventSectionItems }]
        return [
            { label: 'Navigasjon', items: navSectionItems.slice(0, 5) },
            { label: 'Brukere', items: userSectionItems },
            { label: 'Arrangementer', items: eventSectionItems },
        ].filter(section => section.items.length > 0)
    }, [category, navSectionItems, userSectionItems, eventSectionItems])

    const flatItems = useMemo(() => sections.flatMap(section => section.items), [sections])
    const safeActiveIndex = flatItems.length === 0 ? -1 : Math.min(activeIndex, flatItems.length - 1)

    const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value
        setQuery(value)
        setActiveIndex(0)
        updateDebouncedQuery(value)
        if (value.trim()) {
            setLoading(true)
        } else {
            setDebouncedQuery('')
            setUserResults([])
            setEventResults([])
            setLoading(false)
        }
    }

    const handleCategoryChange = (value: Category) => {
        setCategory(value)
        setActiveIndex(0)
        if (debouncedQuery) setLoading(true)
        // ModeSwitch's tab buttons take focus on click, which would otherwise leave the
        // arrow-key/Enter handling on the input dead until the user clicks back into it.
        inputRef.current?.focus()
    }

    const selectItem = (item: SearchItem) => {
        close()
        router.push(item.href)
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault()
            if (flatItems.length === 0) return
            setActiveIndex(previous => Math.min(Math.max(previous, -1) + 1, flatItems.length - 1))
        } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            if (flatItems.length === 0) return
            setActiveIndex(previous => Math.max(previous - 1, 0))
        } else if (event.key === 'Enter') {
            if (safeActiveIndex >= 0) {
                event.preventDefault()
                selectItem(flatItems[safeActiveIndex])
            }
        } else if (event.key === 'Tab') {
            event.preventDefault()
            const currentIndex = availableCategories.findIndex(option => option.value === category)
            const direction = event.shiftKey ? -1 : 1
            const nextIndex = (currentIndex + direction + availableCategories.length) % availableCategories.length
            handleCategoryChange(availableCategories[nextIndex].value)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-[rgba(0,0,0,0.55)] z-20 flex justify-center pt-[12vh] max-mobile:pt-0">
            <div className={[
                'w-[min(800px,90vw)] max-h-[70svh] h-[70svh] bg-[color-mix(in_srgb,var(--surface-base),transparent_40%)]',
                'backdrop-blur-[8px] backdrop-saturate-[140%] rounded-round flex flex-col gap-2 p-4 overflow-hidden',
                'max-mobile:w-screen max-mobile:max-h-svh max-mobile:h-svh max-mobile:rounded-none',
            ].join(' ')} ref={ref}>
                <div className="flex items-center gap-2 shrink-0">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="shrink-0 text-text-muted" />
                    <input
                        ref={inputRef}
                        type="text"
                        className={[
                            'flex-1 min-w-0 border-none bg-transparent outline-none text-l text-text',
                            'placeholder:text-text-muted',
                        ].join(' ')}
                        placeholder="Søk etter brukere, arrangementer og sider..."
                        autoComplete="off"
                        value={query}
                        onChange={handleQueryChange}
                        onKeyDown={handleKeyDown}
                    />
                    {loading && <FontAwesomeIcon icon={faSpinner} spin className="shrink-0 text-text-muted" />}
                    {/* The popup is fullscreen on mobile, so there is no outside to click and no Esc key. */}
                    <button
                        type="button"
                        className="hidden max-mobile:block shrink-0 bg-transparent border-none p-2 cursor-pointer text-l"
                        aria-label="Lukk søk"
                        onClick={close}
                    >
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
                <ModeSwitch options={availableCategories} value={category} onChange={handleCategoryChange} />
                <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-3">
                    {
                        flatItems.length === 0 ? (
                            <p className="my-4 text-center text-text-muted">
                                {trimmedQuery || debouncedQuery ? 'Ingen treff' : 'Begynn å skrive for å søke'}
                            </p>
                        ) : sections.map(section => (
                            <div key={section.label} className="flex flex-col gap-1">
                                <span className="text-s uppercase text-text-muted">{section.label}</span>
                                <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
                                    {section.items.map(item => {
                                        const index = flatItems.indexOf(item)
                                        return (
                                            <li key={item.key}>
                                                <Link
                                                    href={item.href}
                                                    className={[
                                                        'flex items-center gap-2 p-2 rounded-[calc(0.5*var(--gap))]',
                                                        'no-underline transition-colors duration-300',
                                                        index === safeActiveIndex
                                                            ? 'bg-accent-blue text-text-inv'
                                                            : 'text-text hover:bg-surface-hover',
                                                    ].join(' ')}
                                                    onMouseEnter={() => setActiveIndex(index)}
                                                    onClick={close}
                                                >
                                                    <span className={[
                                                        // Image's own wrapper div sizes off the image's intrinsic width, so
                                                        // it is forced to fill the thumbnail box.
                                                        'relative shrink-0 size-10 rounded-[calc(0.5*var(--gap))]',
                                                        'overflow-hidden flex items-center justify-center',
                                                        'bg-surface-hover text-text-muted [&_div]:w-full [&_div]:h-full',
                                                        '[&_img]:absolute [&_img]:inset-0 [&_img]:w-full [&_img]:h-full',
                                                        '[&_img]:object-cover',
                                                    ].join(' ')}>
                                                        {item.thumb.type === 'image' ? (
                                                            <Image image={item.thumb.image} width={40} />
                                                        ) : (
                                                            <FontAwesomeIcon icon={item.thumb.icon} />
                                                        )}
                                                    </span>
                                                    <span className={[
                                                        'flex-1 min-w-0 overflow-hidden',
                                                        'text-ellipsis whitespace-nowrap',
                                                    ].join(' ')}>
                                                        {item.label}
                                                    </span>
                                                    {item.sublabel && (
                                                        <span className="shrink-0 text-s text-inherit opacity-70">
                                                            {item.sublabel}
                                                        </span>
                                                    )}
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))
                    }
                </div>
                <div className="shrink-0 flex flex-wrap gap-3 pt-2 border-t border-surface-hover text-s text-text-muted">
                    <span><kbd className={kbdClassName}>↑</kbd><kbd className={kbdClassName}>↓</kbd> Naviger</span>
                    <span><kbd className={kbdClassName}>↵</kbd> Velg</span>
                    <span><kbd className={kbdClassName}>Tab</kbd> Bytt fane</span>
                    <span><kbd className={kbdClassName}>Esc</kbd> Lukk</span>
                </div>
            </div>
        </div>
    )
}
