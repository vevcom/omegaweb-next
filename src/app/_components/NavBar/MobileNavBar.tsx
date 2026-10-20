import styles from './MobileNavBar.module.scss'
import Menu from './Menu'
import UserNavigation from './UserNavigation'
import StandardImageServer from '@/components/Image/StandardImageServer'
import EditModeSwitch from '@/components/EditModeSwitch/EditModeSwitch'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { NavLink } from './navDef'

type PropTypes = {
    isLoggedIn: boolean
    /** The nav items the session may open, as `visibleNavItems` leaves them. */
    navItems: NavLink[]
}

export default async function MobileNavBar({ isLoggedIn, navItems }: PropTypes) {
    const itemsForNav = navItems.slice(0, 3)

    return (
        <nav className={styles.MobileNavBar}>
            {
                itemsForNav.map((item) => (
                    <div key={item.name}>
                        <Link href={item.href}>
                            <FontAwesomeIcon className={styles.icon} icon={item.icon} width={25}/>
                        </Link>
                    </div>
                ))
            }
            <div className={styles.magicHat}>
                <StandardImageServer
                    standardImage="MAGISK_HATT"
                    width={25}
                    height={25}
                    alt="log in button"
                    tint="var(--text)"
                />
                <UserNavigation isLoggedIn={isLoggedIn} />
            </div>
            <Menu
                items={navItems}
                openBtnVariant={'mobile'}
            />
            <div className={styles.editMode}>
                <EditModeSwitch />
            </div>
        </nav>
    )
}
