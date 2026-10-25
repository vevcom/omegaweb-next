import { QueryParams } from '@/lib/queryParams/queryParams'

/** Where the career pages, the (careers) route group, live. */
export const CAREER_PATH = '/career'

export const CAREERS_EMAIL = 'post@contactor.no'

export const CAREERS_SOCIALS = {
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

/** The links of the career site's navigation: the parts of the career pages, then the way to get in touch. */
export function careerNavLinks(companyPresentationEventTag: { name: string } | null): { name: string, href: string }[] {
    return [
        { name: 'Jobbannonser', href: `${CAREER_PATH}/job-ads` },
        { name: 'Bedriftspresentasjoner', href: companyPresentationsHref(companyPresentationEventTag) },
        { name: 'Bedrifter', href: `${CAREER_PATH}/companies` },
        { name: 'Om oss', href: `${CAREER_PATH}/about` },
        { name: 'Kontakt', href: `mailto:${CAREERS_EMAIL}` },
    ]
}
