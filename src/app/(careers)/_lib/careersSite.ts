import { sitePagesPath, sites } from '@/lib/sites'
import type { EventPagesConfig } from '@/components/Event/Pages/eventPages'
import type { JobAdPagesConfig } from '@/components/JobAds/Pages/jobAdPages'
import type { AuthPagesConfig } from '@/components/Auth/Pages/authPages'

/** Where the career pages, the (careers) route group, live. */
export const CAREER_PATH = sites.CAREERS.basePath

export const CAREER_COMPANIES_PATH = `${CAREER_PATH}/companies`

export const CAREERS_EMAIL = 'post@contactor.no'

export const CAREERS_SOCIALS = {
    facebook: 'https://www.facebook.com/ContactorNTNU/',
    linkedin: 'https://www.linkedin.com/company/contactor-ntnu/',
    instagram: 'https://www.instagram.com/contactorntnu/',
} as const

/** The job ads in the career site's chrome. */
export const careerJobAdPages: JobAdPagesConfig = {
    site: 'CAREERS',
    path: '/job-ads',
}

/**
 * The company presentations as the career site's event pages: the events carrying the special
 * tag, in the career site's chrome.
 */
export const companyPresentationPages: EventPagesConfig = {
    site: 'CAREERS',
    path: '/company-presentations',
    titles: { current: 'Bedriftspresentasjoner', archive: 'Tidligere bedriftspresentasjoner' },
    lockedTag: 'COMPANY_PRESENTATION',
}

/** The sign in and sign up flow on the career site: the same account as on Omega's site, landing on the frontpage. */
export const careersAuthPages: AuthPagesConfig = {
    site: 'CAREERS',
    siteName: 'Contactor',
    afterLoginPath: CAREER_PATH,
    afterLogoutPath: CAREER_PATH,
    accountNotice: 'Contactor er karrieresiden til linjeforeningen Omega ved NTNU, og brukeren du lager her er en '
        + 'bruker på Omegas nettsider. Den samme brukeren gjelder både på Contactor og på Omegaveven.',
}

/** The links of the career site's navigation: the parts of the career pages, then the way to get in touch. */
export const careerNavLinks: { name: string, href: string }[] = [
    { name: 'Jobbannonser', href: sitePagesPath(careerJobAdPages) },
    { name: 'Bedriftspresentasjoner', href: sitePagesPath(companyPresentationPages) },
    { name: 'Bedrifter', href: CAREER_COMPANIES_PATH },
    { name: 'Om oss', href: `${CAREER_PATH}/about` },
    { name: 'Kontakt', href: `mailto:${CAREERS_EMAIL}` },
]
