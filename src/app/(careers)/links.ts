import { careerPages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

/** The pages of the career site outside its kits. Imports nothing of the site, so the kits can link here too. */
export type CareerLinks = {
    frontpage: () => AppHref,
    about: () => AppHref,
    companies: () => AppHref,
    profile: () => AppHref,
}

export const careerLinks: CareerLinks = defineLinks<PagesMount, CareerLinks>(href => ({
    frontpage: () => href(),
    about: () => href('/about'),
    companies: () => href('/companies'),
    profile: () => href('/profile'),
}))(careerPages)
