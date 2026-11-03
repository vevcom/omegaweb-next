import CareersNavBar from './_components/CareersNavBar'
import CareersFooter from './_components/CareersFooter'
import { karla, sora } from './_lib/careersFonts'
import { careersTheme } from './_lib/careersTheme'
import { careerNavLinks } from './_lib/careersSite'
import { innerClassName } from './_lib/careersClassNames'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import { careersFrontpageAuth } from '@/services/careers/frontpage/auth'
import { serverLayout } from '@/app/ServerPage'
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
    operation: () => ({}),
    capabilities: () => ({
        canEditSpecialCmsLink: careersFrontpageAuth.updateSpecialCmsLink,
    }),
    render: ({ capabilities, children }) => (
        <div
            className={`
                min-h-dvh flex flex-col bg-surface-base text-text font-careers-sans [--careers-max-width:1320px]
                [--careers-page-padding:clamp(1.5rem,5vw,4rem)]
                [&_*]:font-careers-sans
                [&_:is(h1,h2,h3,h4)]:font-careers-heading [&_:is(h1,h2,h3,h4)]:tracking-[-0.01em]
                ${karla.variable}
                ${sora.variable}
            `}
            data-tone="light"
        >
            <SiteTheme colors={careersTheme} />
            <CareersNavBar links={careerNavLinks} />
            <main className={`
                ${innerClassName}
                flex-1
            `}>
                {children}
            </main>
            <CareersFooter capabilities={capabilities} />
        </div>
    ),
})
