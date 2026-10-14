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
import { Inter } from 'next/font/google'
import '@/styles/globals.scss'
import { config } from '@fortawesome/fontawesome-svg-core'
import '@fortawesome/fontawesome-svg-core/styles.css'
import { getServerSession } from 'next-auth'
import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'

config.autoAddCss = false

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    // Lets the page paint into the status bar and home indicator areas instead of
    // being letterboxed between them. The safe-area insets in (omegaweb)/layout.module.scss
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

/**
 * The document and what every page shares: the session, the client data and the contexts. What
 * the pages look like is up to the route groups - (omegaweb) is Omega's site with its navigation
 * and the user's theme, (contactor) is Contactor's under /career with its own - so nothing here
 * paints a theme or a nav.
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

    return (
        <html lang="nb">
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
