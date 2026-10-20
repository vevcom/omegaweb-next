'use client'
import styles from './DesktopSideBar.module.scss'
import NavTooltip from './NavTooltip'
import { adminNavItemHref } from './adminNavItemHref'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCog } from '@fortawesome/free-solid-svg-icons'

type PropTypes = {
    /** Whether any page of `adminNavDef` is one the session may open. */
    showAdmin: boolean
    expanded?: boolean
    /** Whether the current page is an admin page. */
    active?: boolean
}

/** Renders nothing at all, not even its divider, when there's no admin page to open. */
export default function AdminNav({ showAdmin, expanded = false, active = false }: PropTypes) {
    if (!showAdmin) return null

    const adminLink = (
        <Link
            href={adminNavItemHref}
            className={`${styles.navIcon} ${active ? styles.active : ''}`}
            aria-label="Admin"
            aria-current={active ? 'page' : undefined}
        >
            <FontAwesomeIcon icon={faCog} className={styles.icon} />
            <span className={styles.label}>Admin</span>
        </Link>
    )

    return (
        <>
            <hr className={styles.divider} />
            <nav className={styles.adminNav} aria-label="Adminnavigasjon">
                {expanded ? adminLink : <NavTooltip content="Admin">{adminLink}</NavTooltip>}
            </nav>
        </>
    )
}
