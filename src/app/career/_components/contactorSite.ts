import { QueryParams } from '@/lib/queryParams/queryParams'
import type { StandardImage } from '@/prisma-generated-pn-types'

/**
 * The career pages are Contactor's site inside Omega's: under this path the root layout leaves
 * out Omega's navigation and the user's theme, and the career layout (src/app/career/layout.tsx)
 * renders Contactor's own navigation, footer and theme instead.
 */
export const CAREER_PATH = '/career'

export const CONTACTOR_EMAIL = 'post@contactor.no'

export const CONTACTOR_SOCIALS = {
    facebook: 'https://www.facebook.com/ContactorNTNU/',
    linkedin: 'https://www.linkedin.com/company/contactor-ntnu/',
    instagram: 'https://www.instagram.com/contactorntnu/',
} as const

/** Whether a request path (as the proxy stamps it, query string included) is one of the career pages. */
export function isCareerPath(path: string): boolean {
    return path === CAREER_PATH || path.startsWith(`${CAREER_PATH}/`) || path.startsWith(`${CAREER_PATH}?`)
}

export type CareerSection = {
    name: string,
    href: string,
    description: string,
    standardImage: StandardImage,
}

/**
 * The three parts of the career pages, as the frontpage presents them and the navigation links
 * them: the job ads, the company presentations (events with the special tag, so the link
 * needs the tag's name) and the companies.
 */
export function careerSections(companyPresentationEventTag: { name: string } | null): CareerSection[] {
    return [
        {
            name: 'Jobbannonser',
            href: `${CAREER_PATH}/job-ads`,
            description: 'Stillinger, sommerjobber og graduate-program fra bedrifter som vil nå studentene våre.',
            standardImage: 'MACHINE',
        },
        {
            name: 'Bedriftspresentasjoner',
            href: `/events?${QueryParams.eventTags.encodeUrl(
                companyPresentationEventTag ? [companyPresentationEventTag.name] : []
            )}`,
            description: 'Kveldspresentasjon med direkte dialog mellom bedrift og studenter.',
            standardImage: 'FAIR',
        },
        {
            name: 'Bedrifter',
            href: `${CAREER_PATH}/companies`,
            description: 'Bedriftene vi samarbeider med, og som møter studentene gjennom Contactor.',
            standardImage: 'REALFAGSBYGGET',
        },
    ]
}
