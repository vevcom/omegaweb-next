'use client'

import { dividerClassName } from './sideBarClassNames'
import { adminNavItemHref } from './adminNavItemHref'
import SideBarNavItem from './SideBarNavItem'
import AdminNav from './AdminNav'
import ScrollIndicator from '@/components/ScrollIndicator/ScrollIndicator'
import useActiveNavHref from '@/hooks/useActiveNavHref'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { useRef, useState } from 'react'
import type { NavLink } from './navDef'

export type PropTypes = {
    /** The nav items the session may open, as `visibleNavItems` leaves them. */
    navItems: NavLink[]
}

export default function DesktopSideBar({ navItems }: PropTypes) {
    const [expanded, setExpanded] = useState(false)
    const navIconsRef = useRef<HTMLElement>(null)

    // The admin item gets its own spot at the bottom rather than a place among the others.
    const showAdmin = navItems.some(item => item.href === adminNavItemHref)
    const sideBarItems = navItems.filter(item => item.href !== adminNavItemHref)
    const activeHref = useActiveNavHref(navItems.map(item => item.href))
    return (
        <aside
            className="group/sidebar h-full w-full flex flex-col items-stretch gap-2 min-h-0 p-2 rounded-round bg-surface-base"
            data-expanded={expanded}
        >
            <div className="group/panel relative w-full flex-auto min-h-0">
                <nav ref={navIconsRef} className="h-full w-full flex flex-col items-stretch gap-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Desktop navigation">
                    {sideBarItems.map((item) => (
                        <SideBarNavItem
                            key={item.name}
                            item={item}
                            expanded={expanded}
                            active={item.href === activeHref}
                        />
                    ))}
                </nav>
                <ScrollIndicator scrollRef={navIconsRef} className="top-2 bottom-2 right-0.5 opacity-0 transition-opacity duration-300 ease-[ease] group-hover/panel:opacity-100 group-focus-within/panel:opacity-100 data-[dragging=true]:opacity-100" />
            </div>
            <AdminNav showAdmin={showAdmin} expanded={expanded} active={activeHref === adminNavItemHref} />
            <hr className={dividerClassName} />
            <button
                type="button"
                className="group w-full h-10 flex items-center justify-center shrink-0 border-none bg-transparent cursor-pointer [&_svg]:text-text [&_svg]:transition-colors [&_svg]:duration-300 [&_path]:text-inherit hover:[&_svg]:text-accent-blue"
                onClick={() => setExpanded(prev => !prev)}
                aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
            >
                <FontAwesomeIcon icon={expanded ? faChevronLeft : faChevronRight} />
            </button>
        </aside>
    )
}
