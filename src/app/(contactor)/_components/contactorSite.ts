import { QueryParams } from '@/lib/queryParams/queryParams'

/** Where the career pages - Contactor's site inside Omega's, the (contactor) route group - live. */
export const CAREER_PATH = '/career'

export const CONTACTOR_EMAIL = 'post@contactor.no'

export const CONTACTOR_SOCIALS = {
    facebook: 'https://www.facebook.com/ContactorNTNU/',
    linkedin: 'https://www.linkedin.com/company/contactor-ntnu/',
    instagram: 'https://www.instagram.com/contactorntnu/',
} as const

/**
 * The events page showing the company presentations: the events with the special tag, so the
 * link needs the tag's name.
 */
export function companyPresentationsHref(companyPresentationEventTag: { name: string } | null): string {
    return `/events?${QueryParams.eventTags.encodeUrl(
        companyPresentationEventTag ? [companyPresentationEventTag.name] : []
    )}`
}

/** The links of Contactor's navigation: the parts of the career pages, then the way to get in touch. */
export function careerNavLinks(companyPresentationEventTag: { name: string } | null): { name: string, href: string }[] {
    return [
        { name: 'Jobbannonser', href: `${CAREER_PATH}/job-ads` },
        { name: 'Bedriftspresentasjoner', href: companyPresentationsHref(companyPresentationEventTag) },
        { name: 'Bedrifter', href: `${CAREER_PATH}/companies` },
        { name: 'Om oss', href: `${CAREER_PATH}/about` },
        { name: 'Kontakt', href: `mailto:${CONTACTOR_EMAIL}` },
    ]
}
