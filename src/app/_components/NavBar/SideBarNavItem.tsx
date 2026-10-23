'use client'

import { navIconClassName, navIconIconClassName, navIconLabelClassName } from './sideBarClassNames'
import NavTooltip from './NavTooltip'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NavLink } from './navDef'

type PropTypes = {
    item: NavLink
    expanded: boolean
    /** Whether the current page is this item's. */
    active: boolean
}

export default function SideBarNavItem({ item, expanded, active }: PropTypes) {
    return (
        <NavTooltip content={item.name} disabled={expanded}>
            <Link
                href={item.href}
                className={navIconClassName}
                aria-label={item.name}
                aria-current={active ? 'page' : undefined}
            >
                <FontAwesomeIcon icon={item.icon} className={navIconIconClassName} />
                <span className={navIconLabelClassName}>{item.name}</span>
            </Link>
        </NavTooltip>
    )
}
