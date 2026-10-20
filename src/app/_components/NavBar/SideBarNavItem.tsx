'use client'

import styles from './DesktopSideBar.module.scss'
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
    const link = (
        <Link
            href={item.href}
            className={`${styles.navIcon} ${active ? styles.active : ''}`}
            aria-label={item.name}
            aria-current={active ? 'page' : undefined}
        >
            <FontAwesomeIcon icon={item.icon} className={styles.icon} />
            <span className={styles.label}>{item.name}</span>
        </Link>
    )

    if (expanded) return link

    return <NavTooltip content={item.name}>{link}</NavTooltip>
}
