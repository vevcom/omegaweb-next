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
const changesAliasAddress = 'Bare eiere som kan opprette aliaser kan endre adressen'

export const mailAliasAuth = {
    /** A creator with the permission must be among the owners they set, so the alias is theirs to go on with. */
    create: Require.permission('MAILSERVER_ADMIN')
        .or()
        .permission('MAIL_ALIAS_CREATE')
        .visibility({ key: 'ownerVisibility', errorMessage: 'Du må selv være blant eierne av aliaset' }),
    /** Listing takes owning at least one, given every alias's owner matrix, and lists those; MAILSERVER_USE lists all. */
    readMany: Require.allOf(
        marksOwnedBySelf,
        Require.permission('MAILSERVER_USE').or().anyVisibility({
            key: 'aliasOwnerVisibilities',
            errorMessage: 'Bare eierne av et alias ser aliasene',
        }),
    ).filter(({ session }) => ({ ownerVisibility: visibilityFilter(session.memberships) })),
    readTraversal: Require.allOf(readsAlias, marksOwnedBySelf),
    /** The aliases one receives mail on are one's own to see, as the mail is. */
    readReceived: Require.userId({ errorMessage: 'Bare du selv ser aliasene du mottar e-post på' }),
    readVisibility: readsAlias,
    readMailAddress: readsAlias,
    /**
     * The address is changed by an owner who may also create aliases, since a new address is as good as a new
     * alias. Both conditions answer with the rule, so an owner without the permission is told the same as a
     * creator who is no owner.
     */
    updateMailAddress: Require.permission('MAILSERVER_ADMIN')
        .or()
        .permission('MAIL_ALIAS_CREATE', { errorMessage: changesAliasAddress })
        .visibility({ errorMessage: changesAliasAddress }),
    updateDescription: ownsAlias,
    /** Whether the mail is also sent on to the private email of those who receive it is the owners' to decide. */
    updateMailAddressForwarding: ownsAlias,
    updateVisibility: ownsAlias,
    destroy: ownsAlias,
} as const
