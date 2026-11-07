import { Require } from '@/auth/authorizer/Require'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'
import { marksOwnedBySelf } from '@/services/mail/auth'

/** An alias is read by those who pass its owner visibility; MAILSERVER_USE reads them all. */
const readsAlias = Require.permission('MAILSERVER_USE').or().visibility({
    errorMessage: 'Bare eierne av aliaset ser det',
})
/** An alias is changed by those who pass its owner visibility; MAILSERVER_ADMIN changes them all. */
const ownsAlias = Require.permission('MAILSERVER_ADMIN').or().visibility({
    errorMessage: 'Bare eierne av aliaset kan endre det',
})

export const mailAliasAuth = {
    /** A creator with the permission must be among the owners they set, so the alias is theirs to go on with. */
    create: Require.permission('MAILSERVER_ADMIN')
        .or()
        .permission('MAIL_ALIAS_CREATE')
        .visibility({ key: 'ownerVisibility', errorMessage: 'Du må selv være blant eierne av aliaset' }),
    readMany: Require.allOf(marksOwnedBySelf, Require.permission('MAILSERVER_USE').or().user()).filter(({ session }) => ({
        ownerVisibility: visibilityFilter(session.memberships),
    })),
    readTraversal: Require.allOf(readsAlias, marksOwnedBySelf),
    readVisibility: readsAlias,
    update: ownsAlias,
    updateVisibility: ownsAlias,
    destroy: ownsAlias,
} as const
