import MobileNavBar from '@/components/NavBar/MobileNavBar'
import DesktopSideBar from '@/components/NavBar/DesktopSideBar'
import NavBar from '@/components/NavBar/NavBar'
import { visibleNavItems } from '@/components/NavBar/navDef'
import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import NavMenuProvider from '@/contexts/NavMenu'
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
        <div className="
            min-h-dvh text-text bg-surface-raised bg-linear-125/srgb from-accent-blue/30 from-0% to-surface-base/20 to-70%
        ">
            <SiteTheme colors={themes[theme]} />
            <GlobalSearch navItems={navItems} />
            <NavMenuProvider>
                <div className="
                    grid grid-cols-[64px_minmax(0,1fr)] grid-rows-[64px_1fr_64px] gap-2 h-dvh max-w-[2560px] mx-auto
                    [grid-template-areas:'navBar_navBar'_'sideBar_content'_'sideBar_content']
                    pt-[calc(var(--gap)+env(safe-area-inset-top))] pr-[calc(var(--gap)+env(safe-area-inset-right))]
                    pb-[calc(var(--gap)+env(safe-area-inset-bottom))] pl-[calc(var(--gap)+env(safe-area-inset-left))]
                    transition-[grid-template-columns] duration-300 ease-[ease]
                    mobile:has-[>aside_[data-expanded=true]]:grid-cols-[220px_minmax(0,1fr)]
                    max-mobile:grid-cols-[minmax(0,1fr)]
                    max-mobile:[grid-template-areas:'navBar'_'content'_'mobileNavBar']
                ">
                    <div className="[grid-area:navBar] col-span-full h-[64px] z-3 rounded-round">
                        <NavBar
                            isLoggedIn={navUser !== null}
                            profileImage={navUser?.image ?? null}
                            navItems={navItems}
                        />
                    </div>
                    <aside className="
                        [grid-area:sideBar] h-full w-full z-3
                        max-mobile:hidden
                    ">
                        <DesktopSideBar navItems={navItems} />
                    </aside>
                    <main className="[grid-area:content] min-h-0 overflow-hidden rounded-round">
                        <ScrollArea className="h-full" scrollerClassName="flex flex-col">
                            {children}
                        </ScrollArea>
                    </main>
                    <div className="
                        hidden z-3 rounded-round overflow-hidden [grid-area:mobileNavBar]
                        max-mobile:block max-mobile:h-[64px] max-mobile:w-full
                    ">
                        <MobileNavBar
                            isLoggedIn={navUser !== null}
                            navItems={navItems}
                        />
                    </div>
                </div>
            </NavMenuProvider>
        </div>
    )
}
