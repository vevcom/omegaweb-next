import { careerPages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

/** The pages of the career site outside its kits. Imports nothing of the site, so the kits can link here too. */
export type CareerLinks = {
    frontpage: () => AppHref,
    about: () => AppHref,
    /** The companies, filtered to those matching `name` when given. */
    companies: (name?: string) => AppHref,
    profile: () => AppHref,
}

export const careerLinks: CareerLinks = defineLinks<PagesMount, CareerLinks>(href => ({
    frontpage: () => href(),
    about: () => href('/about'),
    companies: name => href('/companies', name ? QueryParams.companyName.encodeUrl(name) : undefined),
    profile: () => href('/profile'),
}))(careerPages)
