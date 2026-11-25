import { revueAdminLinks } from './links'
import { mailServerNavAuthorizers } from '@/pageKits/mailServer/navAuthorizers'
import { defineNavDef } from '@/lib/navDef/navDef'
import { revueAuth } from '@/services/revue/auth'
import { revueGroupAuth } from '@/services/revue/groups/auth'
import { faEnvelopesBulk, faMasksTheater, faPeopleGroup } from '@fortawesome/free-solid-svg-icons'

/** The admin pages of the revue site, in the order the sidebar shows them. */
export const revueAdminNavDef = defineNavDef([
    {
        key: 'revues',
        name: 'Revyer',
        href: revueAdminLinks.revues(),
        icon: faMasksTheater,
        authorizers: () => [revueAuth.create, revueAuth.update, revueAuth.destroy],
    },
    {
        key: 'groups',
        name: 'Grupper',
        href: revueAdminLinks.groups(),
        icon: faPeopleGroup,
        authorizers: () => [revueGroupAuth.readMany],
    },
    {
        key: 'mail',
        name: 'E-posttjener',
        href: revueAdminLinks.mail(),
        icon: faEnvelopesBulk,
        authorizers: mailServerNavAuthorizers,
    },
])
