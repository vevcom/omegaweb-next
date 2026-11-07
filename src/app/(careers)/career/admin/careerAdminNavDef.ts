import { careerAdminLinks } from './links'
import { companyAuth } from '@/services/careers/companies/auth'
import { careerFrontpageHighlightAuth } from '@/services/careers/frontpage/highlights/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { defineNavDef } from '@/lib/navDef/navDef'
import { faBuilding, faEnvelopesBulk, faStar } from '@fortawesome/free-solid-svg-icons'

/** The admin pages of the career site, in the order the sidebar shows them. */
export const careerAdminNavDef = defineNavDef([
    {
        key: 'companies',
        name: 'Bedrifter',
        href: careerAdminLinks.companies(),
        icon: faBuilding,
        authorizers: () => [companyAuth.create],
    },
    {
        key: 'highlights',
        name: 'Fremhevinger',
        href: careerAdminLinks.highlights(),
        icon: faStar,
        authorizers: () => [careerFrontpageHighlightAuth.readMany],
    },
    {
        key: 'mail',
        name: 'E-posttjener',
        href: careerAdminLinks.mail(),
        icon: faEnvelopesBulk,
        authorizers: () => [mailAddressExternalAuth.readMany],
    },
])
