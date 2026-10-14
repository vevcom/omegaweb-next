import styles from './layout.module.scss'
import ContactorNavBar from './_components/ContactorNavBar'
import ContactorFooter from './_components/ContactorFooter'
import { karla, sora } from './_components/contactorFonts'
import { careerSections, CONTACTOR_EMAIL } from './_components/contactorSite'
import { eventTagOperations } from '@/services/events/tags/operations'
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
 * Contactor's site inside Omega's. The root layout leaves out Omega's navigation and theme under
 * /career (see isCareerPath); this layout renders Contactor's navigation, footer, fonts and tokens
 * around the career pages, which otherwise use the same services, CMS and components as the rest
 * of the site.
 */
export default serverLayout({
    operation: async () => ({
        companyPresentationEventTag: await withFallback(
            eventTagOperations.readSpecial({ params: { special: 'COMPANY_PRESENTATION' } }),
            null
        ),
    }),
    render: ({ data, children }) => (
        <div className={`${styles.site} ${karla.variable} ${sora.variable}`}>
            <ContactorNavBar links={[
                ...careerSections(data.companyPresentationEventTag),
                { name: 'Kontakt', href: `mailto:${CONTACTOR_EMAIL}` },
            ]} />
            <main className={styles.content}>
                {children}
            </main>
            <ContactorFooter />
        </div>
    ),
})
