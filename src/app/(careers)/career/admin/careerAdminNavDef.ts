import { careerAdminLinks } from './links'
import { companyAuth } from '@/services/careers/companies/auth'
import { mailAliasAuth } from '@/services/mail/alias/auth'
import { mailingListAuth } from '@/services/mail/list/auth'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { defineNavDef } from '@/lib/navDef/navDef'
import { faBuilding, faEnvelopesBulk } from '@fortawesome/free-solid-svg-icons'

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
        key: 'mail',
        name: 'E-posttjener',
        href: careerAdminLinks.mail(),
        icon: faEnvelopesBulk,
        authorizers: () => [
            mailingListAuth.readMany,
            mailAliasAuth.readMany,
            mailAddressExternalAuth.readMany,
        ],
    },
])
