'use client'

import useActiveNavHref from '@/hooks/useActiveNavHref'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NavLink } from './navDef'

type PropTypes = {
    /** Every nav item, so a page belonging to one that doesn't fit in the bar highlights none of these. */
    navItems: NavLink[]
}

/** The first nav items of the mobile nav bar, with the current page's one highlighted. */
export default function MobileNavBarItems({ navItems }: PropTypes) {
    const activeHref = useActiveNavHref(navItems.map(item => item.href))

    return navItems.slice(0, 3).map(item => (
        <div key={item.name}>
            <Link href={item.href} aria-label={item.name} aria-current={item.href === activeHref ? 'page' : undefined}>
                <FontAwesomeIcon
                    className={`
                        size-[25px]!
                        [&_path]:text-inherit
                        ${item.href === activeHref ? 'text-accent-blue' : 'text-text'}
                    `}
                    icon={item.icon}
                    width={25}
                />
            </Link>
        </div>
    ))
}
