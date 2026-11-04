import { careerLinks } from '@/app/(careers)/links'
import { careerJobAdLinks } from '@/app/(careers)/career/job-ads/links'
import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'

export const CAREERS_EMAIL = 'post@contactor.no'

export const CAREERS_SOCIALS = {
    facebook: 'https://www.facebook.com/ContactorNTNU/',
    linkedin: 'https://www.linkedin.com/company/contactor-ntnu/',
    instagram: 'https://www.instagram.com/contactorntnu/',
} as const

/** The links of the career site's navigation: the parts of the career pages, then the way to get in touch. */
export const careerNavLinks: { name: string, href: string }[] = [
    { name: 'Jobbannonser', href: careerJobAdLinks.list() },
    { name: 'Bedriftspresentasjoner', href: companyPresentationLinks.list() },
    { name: 'Bedrifter', href: careerLinks.companies() },
    { name: 'Om oss', href: careerLinks.about() },
    { name: 'Kontakt', href: `mailto:${CAREERS_EMAIL}` },
    { name: 'Min side', href: careerLinks.profile() },
]
