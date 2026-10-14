'use client'
import styles from './SlideSidebar.module.scss'
import useOnNavigation from '@/hooks/useOnNavigation'
import useClickOutsideRef from '@/hooks/useClickOutsideRef'
import useKeyPress from '@/hooks/useKeyPress'
import { Fragment, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { AdminNavGroup, AdminNavLink } from '@/app/(omegaweb)/admin/adminNavDef'

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

    return <div className={`${styles.SlideSidebar} ${open ? styles.open : ''}`}>
        <div className={styles.backdrop} />
        <div ref={sidebarRef}>
            <button
                type="button"
                className={styles.toggleButton}
                aria-label={open ? 'Lukk meny' : 'Åpne meny'}
                aria-expanded={open}
                onClick={() => setOpen(previousOpen => !previousOpen)}
            >
                <FontAwesomeIcon icon={open ? faXmark : faBars} />
            </button>
            <aside className={styles.sidebar}>
                {
                    navigation.map(group => (
                        <Fragment key={group.header.title}>
                            <h3>
                                <FontAwesomeIcon icon={group.header.icon} />
                                {group.header.title}
                            </h3>
                            {
                                group.links.map(link => (
                                    <Link
                                        key={link.title}
                                        href={`/admin/${link.path}`}
                                        className={link.path === currentPath ? styles.active : ''}
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
