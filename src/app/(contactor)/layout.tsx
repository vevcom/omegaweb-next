import styles from './layout.module.scss'
import ContactorNavBar from './_components/ContactorNavBar'
import ContactorFooter from './_components/ContactorFooter'
import { karla, sora } from './_lib/contactorFonts'
import { contactorTheme } from './_lib/contactorTheme'
import SiteTheme from '@/components/SiteTheme/SiteTheme'
import { careerAuth } from '@/services/career/auth'
import { serverLayout } from '@/app/ServerPage'
import type { Metadata } from 'next'

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
    operation: async () => ({}),
    capabilities: () => ({
        canEditSpecialCmsLink: careerAuth.updateSpecialCmsLink,
    }),
    render: ({ capabilities, children }) => (
        <div className={`${styles.site} ${karla.variable} ${sora.variable}`}>
            <SiteTheme colors={contactorTheme} />
            <ContactorNavBar />
            <main className={styles.content}>
                {children}
            </main>
            <ContactorFooter capabilities={capabilities} />
        </div>
    ),
})
