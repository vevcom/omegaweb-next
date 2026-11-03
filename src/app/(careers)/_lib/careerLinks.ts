import { defineLinks } from '@/lib/sites/defineLinks'
import type { SitePages } from '@/lib/sites/defineLinks'

/** The career site itself, which its own pages are relative to. */
export const careerPages: SitePages = { site: 'CAREERS', path: '' }

/** The pages of the career site outside its kits. Imports nothing of the site, so the kits can link here too. */
export type CareerLinks = {
    frontpage: () => string,
    about: () => string,
    companies: () => string,
    profile: () => string,
}

export const careerLinks: CareerLinks = defineLinks<SitePages, CareerLinks>(href => ({
    frontpage: () => href(),
    about: () => href('/about'),
    companies: () => href('/companies'),
    profile: () => href('/profile'),
}))(careerPages)
