'use client'
import useOnNavigation from '@/hooks/useOnNavigation'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useKeyPress from '@/hooks/useKeyPress'
import SiteLink from '@/components/SiteLink/SiteLink'
import { Fragment, useState } from 'react'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { NavGroupLinks } from '@/lib/navDef/groupedNavDef'

type PropTypes = {
    /** The groups of `adminNavDef` the session may open. */
    navigation: NavGroupLinks[]
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
            p-2 min-w-[250px] min-h-0 rounded-round overflow-y-scroll
            max-mobile:p-0 max-mobile:m-0 max-mobile:min-w-0 max-mobile:overflow-visible
        "
    >
        <div
            className={`
                hidden
                max-mobile:block
                fixed inset-0 z-4 bg-black/50 transition-[opacity,visibility] duration-300 ease-[ease]
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
                    items-center justify-center fixed z-6 size-[44px] border-none rounded-full bg-base-100
                    top-[calc(var(--gap)+6px+env(safe-area-inset-top))]
                    right-[calc(2*var(--gap)+env(safe-area-inset-right))] text-base-content cursor-pointer
                "
                aria-label={open ? 'Lukk adminmenyen' : 'Åpne adminmenyen'}
                aria-expanded={open}
                onClick={() => setOpen(previousOpen => !previousOpen)}
            >
                <FontAwesomeIcon icon={open ? faXmark : faBars} />
            </button>
            <aside
                className={`
                    flex flex-col gap-1 overflow-y-auto h-full text-base-content
                    max-mobile:fixed max-mobile:left-0 max-mobile:w-[min(85vw,320px)] max-mobile:h-auto max-mobile:m-0
                    max-mobile:top-[calc(56px+2*var(--gap)+env(safe-area-inset-top))]
                    max-mobile:bottom-[calc(64px+2*var(--gap)+env(safe-area-inset-bottom))] max-mobile:p-2
                    max-mobile:bg-base-100 max-mobile:rounded-r-round max-mobile:z-5 max-mobile:transition-transform
                    max-mobile:duration-300 max-mobile:ease-[ease]
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
                                    py-2 px-3 border-b border-base-300 text-l font-bold text-base-content
                                    [&_svg]:text-[0.8em] [&_svg]:text-inherit
                                "
                            >
                                <FontAwesomeIcon icon={group.header.icon} className="text-base-content" />
                                {group.header.title}
                            </h3>
                            {
                                group.links.map(link => (
                                    <SiteLink
                                        key={link.key}
                                        href={link.href}
                                        onClick={() => setOpen(false)}
                                        className={`
                                            no-underline py-3 px-4 ml-6 transition-colors duration-300
                                            hover:text-primary
                                            ${link.key === currentPath ? 'text-primary' : 'text-base-content'}
                                        `}
                                    >
                                        {link.name}
                                    </SiteLink>
                                ))
                            }
                        </Fragment>
                    ))
                }
            </aside>
        </div>
    </div>
}
