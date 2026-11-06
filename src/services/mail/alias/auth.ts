import { Require } from '@/auth/authorizer/Require'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'

/** An alias is read by those who pass its owner visibility; MAILSERVER_USE reads them all. */
const readsAlias = Require.permission('MAILSERVER_USE').or().visibility({
    errorMessage: 'Bare eierne av aliaset ser det',
})

export const mailAliasAuth = {
    create: Require.permission('MAILSERVER_ADMIN'),
    readMany: Require.permission('MAILSERVER_USE').or().user().filter(({ session }) => ({
        ownerVisibility: visibilityFilter(session.memberships),
    })),
    readTraversal: readsAlias,
    readVisibility: readsAlias,
    update: Require.permission('MAILSERVER_ADMIN'),
    updateVisibility: Require.permission('MAILSERVER_ADMIN'),
    destroy: Require.permission('MAILSERVER_ADMIN'),
} as const
