import type { EventPagesConfig } from '@/components/Event/Pages/eventPages'

/** Where the career pages, the (careers) route group, live. */
export const CAREER_PATH = '/career'

export const CAREERS_EMAIL = 'post@contactor.no'

export const CAREERS_SOCIALS = {
    facebook: 'https://www.facebook.com/ContactorNTNU/',
    linkedin: 'https://www.linkedin.com/company/contactor-ntnu/',
    instagram: 'https://www.instagram.com/contactorntnu/',
} as const

/**
 * The company presentations as the career site's event pages: the events carrying the special
 * tag, in the career site's chrome.
 */
export const companyPresentationPages: EventPagesConfig = {
    basePath: `${CAREER_PATH}/company-presentations`,
    titles: { current: 'Bedriftspresentasjoner', archive: 'Tidligere bedriftspresentasjoner' },
    lockedTag: 'COMPANY_PRESENTATION',
}

/** The links of the career site's navigation: the parts of the career pages, then the way to get in touch. */
export const careerNavLinks: { name: string, href: string }[] = [
    { name: 'Jobbannonser', href: `${CAREER_PATH}/job-ads` },
    { name: 'Bedriftspresentasjoner', href: companyPresentationPages.basePath },
    { name: 'Bedrifter', href: `${CAREER_PATH}/companies` },
    { name: 'Om oss', href: `${CAREER_PATH}/about` },
    { name: 'Kontakt', href: `mailto:${CAREERS_EMAIL}` },
]
