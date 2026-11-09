import { careerAdminPages } from './config'
import { careerMailServerLinks } from '@/app/(careers)/career/admin/mail/links'
import { defineLinks } from '@/lib/sites/defineLinks'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

export type CareerAdminLinks = {
    frontpage: () => AppHref,
    companies: () => AppHref,
    highlights: () => AppHref,
    mail: () => AppHref,
}

export const careerAdminLinks: CareerAdminLinks = defineLinks<PagesMount, CareerAdminLinks>(href => ({
    frontpage: () => href(),
    companies: () => href('/companies'),
    highlights: () => href('/highlights'),
    mail: () => careerMailServerLinks.frontpage(),
}))(careerAdminPages)
