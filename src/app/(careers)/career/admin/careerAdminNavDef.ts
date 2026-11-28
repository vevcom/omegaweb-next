import { careerAdminLinks } from './links'
import { companyAuth } from '@/services/careers/companies/auth'
import { careerFrontpageHighlightCapabilities } from '@/capabilities/careers/frontpage/highlights/capabilities'
import { mailServerNavAuthorizers } from '@/pageKits/mailServer/navAuthorizers'
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
        authorizers: () => [careerFrontpageHighlightCapabilities.readMany.authorizer],
    },
    {
        key: 'mail',
        name: 'E-posttjener',
        href: careerAdminLinks.mail(),
        icon: faEnvelopesBulk,
        authorizers: mailServerNavAuthorizers,
    },
])
