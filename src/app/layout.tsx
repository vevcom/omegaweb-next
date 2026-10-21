import { SessionProvider } from '@/auth/session/useSession'
import MobileNavBar from '@/components/NavBar/MobileNavBar'
import { authOptions } from '@/auth/nextAuth/authOptions'
import EditModeProvider from '@/contexts/EditMode'
import PopUpProvider from '@/contexts/PopUp'
import ClientDataProvider from '@/contexts/ClientData'
import { PageTitleProvider } from '@/contexts/PageTitle'
import GlobalSearchProvider from '@/contexts/GlobalSearch'
import NavMenuProvider from '@/contexts/NavMenu'
import { permissionOperations } from '@/services/permissions/operations'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { userOperations } from '@/services/users/operations'
import { withFallback, withPageSession } from '@/app/ServerPage'
import ReleaseCountdownGate from '@/components/ReleaseCountdown/ReleaseCountdownGate'
import { Theme, lightThemes, themeCssVars, themes } from '@/lib/theme'
import ServiceWorkerRegister from '@/UI/ServiceWorkerRegister'
import GlobalSearch from '@/UI/GlobalSearch'
import DesktopSideBar from '@/components/NavBar/DesktopSideBar'
import ScrollArea from '@/components/ScrollIndicator/ScrollArea'
import { visibleNavItems } from '@/components/NavBar/navDef'
import NavBar from '@/components/NavBar/NavBar'
import { Inter } from 'next/font/google'
import '@/styles/tailwind.css'
import '@/styles/globals.scss'
import { config } from '@fortawesome/fontawesome-svg-core'
import { getServerSession } from 'next-auth'
import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'

config.autoAddCss = false

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    // Lets the page paint into the status bar and home indicator areas instead of
    // being letterboxed between them. The safe-area insets on the wrapper grid
    // are what then keep the nav bars clear of the system UI.
    viewportFit: 'cover',
}

export const metadata: Metadata = {
    title: {
        default: 'Sct. Omega Broderskab',
        template: '%s | Sct. Omega Broderskab',
    },
    description: 'Hjemmesiden for linjeforeningen Sanctus Omega Broderskab ved NTNU.',
    keywords: ['Sanctus Omega Broderskab', 'Sct. Omega Broderskab', 'Sanctus Omega', 'Sct. Omega', 'Omega'],
    appleWebApp: {
        capable: true,
        title: 'Sct. Omega',
        // The only iOS value that lets the page draw behind the status bar - the
        // other two reserve an opaque strip for it. It forces light status bar
        // text, which is why the light themes need a scrim (see PR notes).
        statusBarStyle: 'black-translucent',
    },
}

type PropTypes = {
    children: ReactNode
}

export default async function RootLayout({ children }: PropTypes) {
    const nextAuthSession = await getServerSession(authOptions)

    const {
        serverSession, defaultPermissions, standardImages, navUser,
    } = await withPageSession(async (session) => {
        const [defaultPermissions_, standardImages_] = await Promise.all([
            withFallback(permissionOperations.readDefaultPermissions({}), undefined),
            withFallback(standardImageCollectionOperations.readAllStandardImages({}), undefined),
        ])
        const profileRead = session.user
            ? await withFallback(userOperations.readProfile({ params: { username: session.user.username } }), null)
            : null
        return {
            serverSession: session,
            defaultPermissions: defaultPermissions_,
            standardImages: standardImages_,
            // The nav components get the fields they actually render rather than the whole
            // profile, so nothing beyond these reaches the client components among them.
            navUser: profileRead?.user ?? null,
        }
    })
    const navItems = visibleNavItems(serverSession)
    // Rendering the theme's variables server side is what keeps the first paint from flashing the
    // default theme. Anyone not logged in gets the default, which globals.scss already holds.
    const theme = serverSession.user?.theme ?? Theme.STANDARD

    return (
        <html lang="nb" style={themeCssVars(theme)} data-tone={lightThemes.has(theme) ? 'light' : 'dark'}>
            <body className={`
                ${inter.className}
                text-text bg-surface-raised bg-linear-125/srgb from-accent-blue/30 from-0% to-surface-base/20 to-70%
            `}>
                {/* Hoisted into the head by React. Keeps the browser chrome in step with the theme;
                    picking another one refreshes the page, which renders it anew. */}
                <meta name="theme-color" content={themes[theme]['surface-base']} />
                <ServiceWorkerRegister />
                <SessionProvider session={nextAuthSession}>
                    <ClientDataProvider
                        session={serverSession.toJsObject()}
                        defaultPermissions={defaultPermissions}
                        standardImages={standardImages}
                    >
                        <GlobalSearchProvider>
                            <GlobalSearch navItems={navItems} />
                            <EditModeProvider>
                                <PopUpProvider>
                                    <PageTitleProvider>
                                        <ReleaseCountdownGate>
                                            <NavMenuProvider>
                                                <div className="
                                                    grid grid-cols-[64px_minmax(0,1fr)] grid-rows-[64px_1fr_64px] gap-2
                                                    h-dvh max-w-[2560px] mx-auto
                                                    [grid-template-areas:'navBar_navBar'_'sideBar_content'_'sideBar_content']
                                                    pt-[calc(var(--gap)+env(safe-area-inset-top))]
                                                    pr-[calc(var(--gap)+env(safe-area-inset-right))]
                                                    pb-[calc(var(--gap)+env(safe-area-inset-bottom))]
                                                    pl-[calc(var(--gap)+env(safe-area-inset-left))]
                                                    transition-[grid-template-columns] duration-300 ease-[ease]
                                                    mobile:has-[>aside_[data-expanded=true]]:grid-cols-[220px_minmax(0,1fr)]
                                                    max-mobile:grid-cols-[minmax(0,1fr)]
                                                    max-mobile:[grid-template-areas:'navBar'_'content'_'mobileNavBar']
                                                ">
                                                    <div className="
                                                        [grid-area:navBar] col-span-full h-[64px] z-3 rounded-round
                                                    ">
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
                                                    <main className="
                                                        [grid-area:content] min-h-0 overflow-hidden rounded-round
                                                    ">
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
                                        </ReleaseCountdownGate>
                                    </PageTitleProvider>
                                </PopUpProvider>
                            </EditModeProvider>
                        </GlobalSearchProvider>
                    </ClientDataProvider>
                </SessionProvider>
            </body>
        </html>
    )
}
