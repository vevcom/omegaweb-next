import { careerPages } from './config'
import { defineLinks } from '@/lib/sites/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import { QueryParams } from '@/lib/queryParams/queryParams'
import type { AppHref } from '@/lib/sites/href'
import type { PagesMount } from '@/lib/sites/defineLinks'

type CompanyOfLink = { name: string, id: number }
type CompanyUserOfLink = { firstname: string, lastname: string, id: number }

/** The pages of the career site outside its kits. Imports nothing of the site, so the kits can link here too. */
export type CareerLinks = {
    frontpage: () => AppHref,
    about: () => AppHref,
    /** The companies, filtered to those matching `name` when given. */
    companies: (name?: string) => AppHref,
    /** The page of one company, and the tabs under it. */
    company: (company: CompanyOfLink) => AppHref,
    companyUsers: (company: CompanyOfLink) => AppHref,
    companySettings: (company: CompanyOfLink) => AppHref,
    /** The page of one of a company's users. */
    companyUser: (company: CompanyOfLink, companyUser: CompanyUserOfLink) => AppHref,
    profile: () => AppHref,
    /** Where a company user chooses a password, from the link in a mail. */
    companyPassword: (token: string) => AppHref,
}

const companyPath = (company: CompanyOfLink) => `/companies/${formatVevenUri(company.name, company.id)}`

export const careerLinks: CareerLinks = defineLinks<PagesMount, CareerLinks>(href => ({
    frontpage: () => href(),
    about: () => href('/about'),
    companies: name => href('/companies', name ? QueryParams.companyName.encodeUrl(name) : undefined),
    company: company => href(companyPath(company)),
    companyUsers: company => href(`${companyPath(company)}/users`),
    companySettings: company => href(`${companyPath(company)}/settings`),
    companyUser: (company, companyUser) => href(
        `${companyPath(company)}/users/${formatVevenUri(`${companyUser.firstname} ${companyUser.lastname}`, companyUser.id)}`
    ),
    profile: () => href('/profile'),
    companyPassword: token => href('/company-password', QueryParams.token.encodeUrl(token)),
}))(careerPages)
