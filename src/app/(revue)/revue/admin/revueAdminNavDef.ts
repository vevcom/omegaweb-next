import { revueAdminLinks } from './links'
import { mailAddressExternalAuth } from '@/services/mail/mailAddressExternal/auth'
import { defineNavDef } from '@/lib/navDef/navDef'
import { faEnvelopesBulk } from '@fortawesome/free-solid-svg-icons'

/** The admin pages of the revue site, in the order the sidebar shows them. */
export const revueAdminNavDef = defineNavDef([
    {
        key: 'mail',
        name: 'E-posttjener',
        href: revueAdminLinks.mail(),
        icon: faEnvelopesBulk,
        authorizers: () => [mailAddressExternalAuth.readMany],
    },
])
