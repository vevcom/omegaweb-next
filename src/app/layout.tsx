import { SessionProvider } from '@/auth/session/useSession'
import { authOptions } from '@/auth/nextAuth/authOptions'
import EditModeProvider from '@/contexts/EditMode'
import PopUpProvider from '@/contexts/PopUp'
import ClientDataProvider from '@/contexts/ClientData'
import { PageTitleProvider } from '@/contexts/PageTitle'
import GlobalSearchProvider from '@/contexts/GlobalSearch'
import { permissionOperations } from '@/services/permissions/operations'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { withFallback, withPageSession } from '@/app/ServerPage'
import ReleaseCountdownGate from '@/components/ReleaseCountdown/ReleaseCountdownGate'
import ServiceWorkerRegister from '@/UI/ServiceWorkerRegister'
import { Theme, lightThemes } from '@/lib/theme'
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
    // being letterboxed between them. The safe-area insets on the wrapper grid in
    // (omegaweb)/layout.tsx are what then keep the nav bars clear of the system UI.
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

/**
 * The document and what every page shares: the session, the client data and the contexts. What
 * the pages look like is up to the route groups - (omegaweb) is Omega's site with its navigation
 * and the user's theme, (contactor) is Contactor's under /career with its own - so nothing here
 * paints a theme or a nav. Only the tone of the user's theme sits on <html>, so that pop-ups,
 * which teleport to the body, keep it; (contactor) sets its own tone on its wrapper.
 */
export default async function RootLayout({ children }: PropTypes) {
    const nextAuthSession = await getServerSession(authOptions)

    const { serverSession, defaultPermissions, standardImages } = await withPageSession(async (session) => {
        const [defaultPermissions_, standardImages_] = await Promise.all([
            withFallback(permissionOperations.readDefaultPermissions({}), undefined),
            withFallback(standardImageCollectionOperations.readAllStandardImages({}), undefined),
        ])
        return {
            serverSession: session,
            defaultPermissions: defaultPermissions_,
            standardImages: standardImages_,
        }
    })
    const theme = serverSession.user?.theme ?? Theme.STANDARD

    return (
        <html lang="nb" data-tone={lightThemes.has(theme) ? 'light' : 'dark'}>
            <body className={inter.className}>
                <ServiceWorkerRegister />
                <SessionProvider session={nextAuthSession}>
                    <ClientDataProvider
                        session={serverSession.toJsObject()}
                        defaultPermissions={defaultPermissions}
                        standardImages={standardImages}
                    >
                        <GlobalSearchProvider>
                            <EditModeProvider>
                                <PopUpProvider>
                                    <PageTitleProvider>
                                        <ReleaseCountdownGate>
                                            {children}
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
