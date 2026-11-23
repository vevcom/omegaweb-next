import RevueNavBar from './RevueNavBar'
import RevueFooter from './RevueFooter'
import { innerClassName } from '@/app/(revue)/_lib/revueClassNames'
import { revueAdminNavDef } from '@/app/(revue)/revue/(static-theme)/admin/revueAdminNavDef'
import CompanyUserBand from '@/components/CompanyUserBand/CompanyUserBand'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import { withPageSession } from '@/app/ServerPage'
import type { ThemeColors } from '@/lib/theme'
import type { ReactNode } from 'react'

type PropTypes = {
    theme: ThemeColors,
    children: ReactNode,
}

/**
 * The revue site's header, footer and theme around a page, like the career site's. The wrapper carries
 * the tone of the theme it paints, so the tone of the user's own theme on <html> does not reach the
 * pages.
 */
export default async function RevueShell({ theme, children }: PropTypes) {
    const { loggedIn, companyUser, hasAdminPages } = await withPageSession(async session => ({
        loggedIn: session.user !== null,
        companyUser: session.companyUser,
        hasAdminPages: (await revueAdminNavDef.visible(session)).length > 0,
    }))

    return (
        <div
            className="
                min-h-dvh flex flex-col bg-base-100 text-base-content [--revue-max-width:1100px]
                [--revue-page-padding:clamp(1rem,4vw,3rem)]
            "
            data-tone={theme['color-scheme']}
        >
            <SiteTheme colors={theme} />
            <CompanyUserBand companyUser={companyUser} />
            <RevueNavBar loggedIn={loggedIn} hasAdminPages={hasAdminPages} />
            <main className={`
                ${innerClassName}
                flex-1 py-8
            `}>
                {children}
            </main>
            <RevueFooter loggedIn={loggedIn} />
        </div>
    )
}
