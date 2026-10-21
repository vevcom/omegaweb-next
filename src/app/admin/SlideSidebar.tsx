'use client'
import useOnNavigation from '@/hooks/useOnNavigation'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useKeyPress from '@/hooks/useKeyPress'
import { Fragment, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { AdminNavGroup, AdminNavLink } from '@/app/admin/adminNavDef'

type PropTypes = {
    /** The groups of `adminNavDef` the session may open, as `visibleAdminNav` leaves them. */
    navigation: (Omit<AdminNavGroup, 'links'> & { links: Pick<AdminNavLink, 'title' | 'path'>[] })[]
}

/**
 * Component that renders a sidebar that can be toggled on and off.
 * @param children - The children to render in the sidebar.
 * @returns
 */
export default function SlideSidebar({ navigation }: PropTypes) {
    const pathname = usePathname()
    // pathname takes form /admin/[currentPath]/... => ['', 'admin', '[currentPath]', ...]
    const currentPath = pathname.split('/').length > 2 ? pathname.split('/')[2] : 'admin'
    const [open, setOpen] = useState(currentPath === 'admin')

    useOnNavigation(() => setOpen(currentPath === 'admin'))

    const sidebarRef = useClickOutsideRef(() => setOpen(false))
    useKeyPress('Escape', () => setOpen(false))

    return <div
        className="
            p-2 min-w-[250px] rounded-round max-h-[calc(100dvh-64px-26px)] overflow-y-scroll
            max-mobile:p-0 max-mobile:m-0 max-mobile:min-w-0 max-mobile:max-h-none max-mobile:overflow-visible
        "
    >
        <div
            className={`
                hidden fixed inset-0 z-4 bg-black/50 transition-[opacity,visibility] duration-300 ease-[ease]
                ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}
            `}
        />
        <div ref={sidebarRef}>
            <button
                type="button"
                data-slide-sidebar-toggle
                className="
                    hidden
                    max-mobile:flex
                    items-center justify-center fixed top-4 right-6 z-6 size-[44px] border-none rounded-full
                    bg-surface-raised text-text cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.25)]
                "
                aria-label={open ? 'Lukk meny' : 'Åpne meny'}
                aria-expanded={open}
                onClick={() => setOpen(previousOpen => !previousOpen)}
            >
                <FontAwesomeIcon icon={open ? faXmark : faBars} />
            </button>
            <aside
                className={`
                    flex flex-col gap-1 overflow-y-auto h-full text-text
                    max-mobile:fixed max-mobile:top-[calc(64px+2*var(--gap))] max-mobile:left-0
                    max-mobile:w-[min(85vw,320px)] max-mobile:h-[calc(100dvh-128px-4*var(--gap))] max-mobile:m-0
                    max-mobile:p-2 max-mobile:bg-surface-base max-mobile:rounded-r-round max-mobile:z-5
                    max-mobile:transition-transform max-mobile:duration-300 max-mobile:ease-[ease]
                    ${open ? 'max-mobile:translate-x-0' : 'max-mobile:-translate-x-full'}
                `}
            >
                {
                    navigation.map(group => (
                        <Fragment key={group.header.title}>
                            <h3
                                className="
                                    flex items-center gap-2 mt-4 mb-1 mx-0
                                    first:mt-0
                                    py-2 px-3 border-b border-surface-hover text-l font-bold text-ink-strong
                                    [&_svg]:text-[0.8em] [&_svg]:text-inherit
                                    [&_path]:text-inherit
                                "
                            >
                                <FontAwesomeIcon icon={group.header.icon} />
                                {group.header.title}
                            </h3>
                            {
                                group.links.map(link => (
                                    <Link
                                        key={link.title}
                                        href={`/admin/${link.path}`}
                                        className={`
                                            no-underline py-3 px-4 ml-6 transition-colors duration-300
                                            hover:text-accent-blue
                                            ${link.path === currentPath ? 'text-accent-blue' : 'text-text'}
                                        `}
                                    >
                                        {link.title}
                                    </Link>
                                ))
                            }
                        </Fragment>
                    ))
                }
            </aside>
        </div>
    </div>
}
