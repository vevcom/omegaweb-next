import styles from './layout.module.scss'
import ContactorNavBar from './_components/ContactorNavBar'
import ContactorFooter from './_components/ContactorFooter'
import { karla, sora } from './_lib/contactorFonts'
import { contactorTheme } from './_lib/contactorTheme'
import { careerNavLinks } from './_lib/contactorSite'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import { eventTagOperations } from '@/services/events/tags/operations'
import { careerAuth } from '@/services/career/auth'
import { serverLayout, withFallback } from '@/app/ServerPage'
import type { Metadata } from 'next'

// Contactor's pages carry its name, not Omega's, in the tab.
export const metadata: Metadata = {
    title: {
        default: 'Contactor NTNU',
        template: '%s | Contactor NTNU',
    },
    description: 'Contactor knytter bedrifter til studenter i kybernetikk og robotikk og elektronisk '
        + 'systemdesign og innovasjon ved NTNU. Vi arrangerer bedriftspresentasjoner, stand og intervjudager.',
}

/**
 * Contactor's site inside Omega's: the career pages, with Contactor's navigation, footer, fonts
 * and theme in place of Omega's. The pages themselves use the same services, CMS and components
 * as the rest of the site.
 */
export default serverLayout({
    operation: async () => ({
        companyPresentationEventTag: await withFallback(
            eventTagOperations.readSpecial({ params: { special: 'COMPANY_PRESENTATION' } }),
            null
        ),
    }),
    capabilities: () => ({
        canEditSpecialCmsLink: careerAuth.updateSpecialCmsLink,
    }),
    render: ({ data, capabilities, children }) => (
        <div className={`
            ${styles.site}
            ${karla.variable}
            ${sora.variable}
        `} data-tone="light">
            <SiteTheme colors={contactorTheme} />
            <ContactorNavBar links={careerNavLinks(data.companyPresentationEventTag)} />
            <main className={styles.content}>
                {children}
            </main>
            <ContactorFooter capabilities={capabilities} />
        </div>
    ),
})
