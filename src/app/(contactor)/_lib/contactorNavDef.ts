import { CONTACTOR_EMAIL } from './contactorContact'

/** Where the career pages - Contactor's site inside Omega's, the (contactor) route group - live. */
export const CAREER_PATH = '/career'

/**
 * The links of Contactor's navigation, in its order: the parts of the career pages, then the way to
 * get in touch. Keyed so the pages can link to one another through it.
 */
export const contactorNavDef = {
    jobAds: { name: 'Jobbannonser', href: `${CAREER_PATH}/job-ads` },
    companyPresentations: { name: 'Bedriftspresentasjoner', href: `${CAREER_PATH}/company-presentations` },
    companies: { name: 'Bedrifter', href: `${CAREER_PATH}/companies` },
    about: { name: 'Om oss', href: `${CAREER_PATH}/about` },
    contact: { name: 'Kontakt', href: `mailto:${CONTACTOR_EMAIL}` },
} as const satisfies Record<string, { name: string, href: string }>
