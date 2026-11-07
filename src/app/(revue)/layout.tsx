import RevueNavBar from './_components/RevueNavBar'
import { revueAdminNavDef } from '@/app/(revue)/revue/admin/revueAdminNavDef'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import WorkInProgressBanner from '@/components/WorkInProgressBanner/WorkInProgressBanner'
import { externalHref } from '@/lib/sites/href'
import { Theme, themes } from '@/lib/theme'
import { serverLayout } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: {
        default: 'Omegarevyen',
        template: '%s | Omegarevyen',
    },
    description: 'Omegarevyen, revyen til linjeforeningen Omega ved NTNU.',
}

/**
 * The revue pages as their own site inside Omega's, like the career pages: their own navigation,
 * and their own theme once they have one. Until then they keep Omega's default theme.
 */
export default serverLayout({
    allowUnregistered: true,
    operation: ({ session }: LayoutOperationArgs) => ({
        loggedIn: session.user !== null,
        hasAdminPages: revueAdminNavDef.visible(session).length > 0,
    }),
    render: ({ data, children }) => (
        <div className="min-h-dvh flex flex-col bg-base-100 text-base-content">
            <SiteTheme colors={themes[Theme.STANDARD]} />
            <WorkInProgressBanner siteName="Omegarevyen" currentSiteHref={externalHref('https://omegarevyen.no')} />
            <RevueNavBar loggedIn={data.loggedIn} hasAdminPages={data.hasAdminPages} />
            <main className="flex-1 w-full max-w-[1100px] mx-auto px-[clamp(1rem,4vw,3rem)] py-8">
                {children}
            </main>
        </div>
    ),
})
