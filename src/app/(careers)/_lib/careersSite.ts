import { careerLinks } from '@/app/(careers)/links'
import { careerJobAdLinks } from '@/app/(careers)/career/job-ads/links'
import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'
import { externalHref } from '@/lib/sites/href'
import type { AppHref, ExternalHref } from '@/lib/sites/href'

export const CAREERS_EMAIL = 'post@contactor.no'

export const CAREERS_SOCIALS = {
    facebook: externalHref('https://www.facebook.com/ContactorNTNU/'),
    linkedin: externalHref('https://www.linkedin.com/company/contactor-ntnu/'),
    instagram: externalHref('https://www.instagram.com/contactorntnu/'),
} as const

/** The links of the career site's navigation: the parts of the career pages, then the way to get in touch. */
export const careerNavLinks: { name: string, href: AppHref | ExternalHref }[] = [
    { name: 'Jobbannonser', href: careerJobAdLinks.list() },
    { name: 'Bedriftspresentasjoner', href: companyPresentationLinks.list() },
    { name: 'Bedrifter', href: careerLinks.companies() },
    { name: 'Om oss', href: careerLinks.about() },
    { name: 'Kontakt', href: externalHref(`mailto:${CAREERS_EMAIL}`) },
    { name: 'Min side', href: careerLinks.profile() },
]
