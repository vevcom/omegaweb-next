import RevueNavBar from './_components/RevueNavBar'
import RevueFooter from './_components/RevueFooter'
import { revueTheme } from './_lib/revueTheme'
import { innerClassName } from './_lib/revueClassNames'
import CompanyUserBand from '@/components/CompanyUserBand/CompanyUserBand'
import { revueAdminNavDef } from '@/app/(revue)/revue/admin/revueAdminNavDef'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
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
 * The revue pages as their own site inside Omega's, like the career pages: their own header, footer
 * and theme. The wrapper carries the tone of the theme it paints, so the tone of the user's own theme
 * on <html> does not reach the pages.
 */
export default serverLayout({
    allowUnregistered: true,
    operation: async ({ session }: LayoutOperationArgs) => ({
        loggedIn: session.user !== null,
        companyUser: session.companyUser,
        hasAdminPages: (await revueAdminNavDef.visible(session)).length > 0,
    }),
    render: ({ data, children }) => (
        <div
            className="
                min-h-dvh flex flex-col bg-base-100 text-base-content [--revue-max-width:1100px]
                [--revue-page-padding:clamp(1rem,4vw,3rem)]
            "
            data-tone={revueTheme['color-scheme']}
        >
            <SiteTheme colors={revueTheme} />
            <CompanyUserBand companyUser={data.companyUser} />
            <RevueNavBar loggedIn={data.loggedIn} hasAdminPages={data.hasAdminPages} />
            <main className={`
                ${innerClassName}
                flex-1 py-8
            `}>
                {children}
            </main>
            <RevueFooter loggedIn={data.loggedIn} />
        </div>
    ),
})
