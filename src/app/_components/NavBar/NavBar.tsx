import Item from './Item'
import styles from './NavBar.module.scss'
import UserNavigation from './UserNavigation'
import ReportButton from './ReportButton'
import SearchButton from './SearchButton'
import NavBarTitle from './NavBarTitle'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import StandardImageServer from '@/components/Image/StandardImageServer'
import ProfilePicture from '@/components/User/ProfilePicture'
import Link from 'next/link'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { NavLink } from './navDef'

export type PropTypes = {
    isLoggedIn: boolean,
    profileImage: ExpandedImage | null,
    /** The nav items the session may open, as `visibleNavItems` leaves them. */
    navItems: NavLink[],
}

export default async function NavBar({ isLoggedIn, profileImage, navItems }: PropTypes) {
    const navSize = 4
    const itemsForNav = navItems.slice(0, navSize - 1)

    return (
        <nav className={styles.NavBar}>
            <ul className={styles.list}>
                <li className={styles.logoContainer}>
                    <Link aria-label={'Gå til hjemmesiden'} href="/" className={styles.logo}>
                        <div className={styles.logoWrapper}>
                            <StandardImageServer
                                standardImage="LOGO_SIMPLE"
                                width={30}
                                alt="omega logo"
                                tint="var(--surface-base)"
                            />
                        </div>
                    </Link>
                </li>

                <PageTitleSetter title="" />
                <li className={styles.pageTitleLi}>
                    <NavBarTitle />
                </li>
                <li className={styles.grower}></li>
                {
                    itemsForNav.map((item) => (
                        <li className={styles.navItem} key={item.name}>
                            <Item key={item.name} {...item} />
                        </li>
                    ))
                }
                <li className={styles.rightSide}>
                    <SearchButton/>
                    <ReportButton/>
                    <div className={`${styles.magicHat} ${isLoggedIn ? styles.loggedIn : styles.loggedOut}`}>
                        {
                            profileImage ? (
                                <ProfilePicture
                                    profileImage={profileImage}
                                    width={48}
                                />
                            ) : (
                                <span>Logg inn</span>
                            )
                        }
                        <UserNavigation isLoggedIn={isLoggedIn} />
                    </div>
                </li>
            </ul>
        </nav>
    )
}
