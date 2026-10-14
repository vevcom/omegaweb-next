import styles from './layout.module.scss'
import MobileNavBar from '@/components/NavBar/MobileNavBar'
import DesktopSideBar from '@/components/NavBar/DesktopSideBar'
import NavBar from '@/components/NavBar/NavBar'
import { visibleNavItems } from '@/components/NavBar/navDef'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import GlobalSearch from '@/UI/GlobalSearch'
import { userOperations } from '@/services/users/operations'
import { withFallback, withPageSession } from '@/app/ServerPage'
import { Theme, themes } from '@/lib/theme'
import type { ReactNode } from 'react'

type PropTypes = {
    children: ReactNode
}

/**
 * Omega's site: the navigation around every page but Contactor's (see the (contactor) group), in
 * the theme the user has chosen. Like the root layout it loads with withPageSession rather than
 * serverLayout, as the registration pages are under it and must stay reachable for a user who
 * has not finished registering.
 */
export default async function OmegaWebLayout({ children }: PropTypes) {
    const { serverSession, navUser } = await withPageSession(async (session) => {
        const profileRead = session.user
            ? await withFallback(userOperations.readProfile({ params: { username: session.user.username } }), null)
            : null
        return {
            serverSession: session,
            // The nav components get the fields they actually render rather than the whole
            // profile, so nothing beyond these reaches the client components among them.
            navUser: profileRead?.user ?? null,
        }
    })
    const navItems = visibleNavItems(serverSession)
    // Anyone not logged in gets the default theme, which globals.scss already holds.
    const theme = serverSession.user?.theme ?? Theme.STANDARD

    return (
        <div className={styles.site}>
            <SiteTheme colors={themes[theme]} />
            <GlobalSearch navItems={navItems} />
            <div className={styles.wrapper}>
                <div className={styles.navBar}>
                    <NavBar
                        isLoggedIn={navUser !== null}
                        profileImage={navUser?.image ?? null}
                        navItems={navItems}
                    />
                </div>
                <aside className={styles.sideBar}>
                    <DesktopSideBar navItems={navItems} />
                </aside>
                <main className={styles.content}>
                    {children}
                </main>
                <div className={styles.mobileNavBar}>
                    <MobileNavBar
                        isLoggedIn={navUser !== null}
                        navItems={navItems}
                    />
                </div>
            </div>
        </div>
    )
}
