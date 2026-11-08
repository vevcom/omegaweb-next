import CareersNavBar from './_components/CareersNavBar'
import CareersFooter from './_components/CareersFooter'
import { karla, sora } from './_lib/careersFonts'
import { careersTheme } from './_lib/careersTheme'
import { careerAccountNavDef, careerNavDef } from './_lib/careerNavDef'
import { innerClassName } from './_lib/careersClassNames'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import { CareersGlobalSearch, CareersGlobalSearchProvider } from '@/app/(careers)/GlobalSearch'
import { careerAdminNavDef } from '@/app/(careers)/career/admin/careerAdminNavDef'
import WorkInProgressBanner from '@/components/WorkInProgressBanner/WorkInProgressBanner'
import { externalHref } from '@/lib/sites/href'
import { careersFrontpageAuth } from '@/services/careers/frontpage/auth'
import { searchableCategories } from '@/services/search/constants'
import { careersSearchCategories } from '@/services/careers/search/constants'
import { omegaMembershipGroupOperations } from '@/services/groups/omegaMembershipGroups/operations'
import { serverLayout, withFallback } from '@/app/ServerPage'
import type { LayoutOperationArgs } from '@/app/ServerPage'
import type { Metadata } from 'next'

// The career pages carry Contactor's name, not Omega's, in the tab.
export const metadata: Metadata = {
    title: {
        default: 'Contactor NTNU',
        template: '%s | Contactor NTNU',
    },
    description: 'Contactor knytter bedrifter til studenter i kybernetikk og robotikk og elektronisk '
        + 'systemdesign og innovasjon ved NTNU. Vi arrangerer bedriftspresentasjoner, stand og intervjudager.',
}

/**
 * The career pages as their own site inside Omega's, with their own navigation, footer, fonts
 * and theme in place of Omega's. The pages themselves use the same services, CMS and components
 * as the rest of the site.
 */
export default serverLayout({
    allowUnregistered: true,
    operation: async ({ session }: LayoutOperationArgs) => {
        const level = session.user
            ? await withFallback(
                omegaMembershipGroupOperations.readUserLevel({ params: { userId: session.user.id } }),
                null,
            )
            : null
        return {
            loggedIn: session.user !== null,
            omegaMember: level !== null && level.level !== 'DEN_GEMENE_HOB',
            navLinks: careerNavDef.visible(session),
            accountLinks: careerAccountNavDef.visible(session),
            adminNavLinks: careerAdminNavDef.visible(session),
            searchCategories: searchableCategories(careersSearchCategories, session),
        }
    },
    capabilities: () => ({
        canEditSpecialCmsLink: careersFrontpageAuth.updateSpecialCmsLink,
    }),
    render: ({ data, capabilities, children }) => (
        <div
            className={`
                min-h-dvh flex flex-col bg-base-100 text-base-content font-careers-sans [--careers-max-width:1320px]
                [--careers-page-padding:clamp(1.5rem,5vw,4rem)]
                [&_*]:font-careers-sans
                [&_:is(h1,h2,h3,h4)]:font-careers-heading [&_:is(h1,h2,h3,h4)]:tracking-[-0.01em]
                ${karla.variable}
                ${sora.variable}
            `}
            data-tone="light"
        >
            <SiteTheme colors={careersTheme} />
            <CareersGlobalSearchProvider>
                <CareersGlobalSearch
                    navItems={[...data.navLinks, ...data.accountLinks]}
                    adminNavItems={data.adminNavLinks}
                    categories={data.searchCategories}
                />
                <WorkInProgressBanner siteName="Contactor" currentSiteHref={externalHref('https://contactor.no')} />
                <CareersNavBar
                    links={data.navLinks}
                    accountLinks={data.accountLinks}
                    loggedIn={data.loggedIn}
                    showOmegaLink={data.omegaMember}
                />
                <main className={`
                    ${innerClassName}
                    flex-1
                `}>
                    {children}
                </main>
                <CareersFooter capabilities={capabilities} showOmegaLink={data.omegaMember} />
            </CareersGlobalSearchProvider>
        </div>
    ),
})
