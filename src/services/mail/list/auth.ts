import { Require } from '@/auth/authorizer/Require'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'
import { marksOwnedBySelf } from '@/services/mail/auth'

/** A mailing list is read by those who pass its owner visibility; MAILSERVER_USE reads them all. */
const readsMailingList = Require.permission('MAILSERVER_USE').or().visibility({
    errorMessage: 'Bare eierne av e-postlisten ser den',
})
/** A mailing list is changed by those who pass its owner visibility; MAILSERVER_ADMIN changes them all. */
const ownsMailingList = Require.permission('MAILSERVER_ADMIN').or().visibility({
    errorMessage: 'Bare eierne av e-postlisten kan endre den',
})

export const mailingListAuth = {
    /** A creator with the permission must be among the owners they set, so the list is theirs to go on with. */
    create: Require.permission('MAILSERVER_ADMIN')
        .or()
        .permission('MAIL_LIST_CREATE')
        .visibility({ key: 'ownerVisibility', errorMessage: 'Du må selv være blant eierne av e-postlisten' }),
    /** Listing takes owning at least one, given every list's owner matrix, and lists those; MAILSERVER_USE lists all. */
    readMany: Require.allOf(
        marksOwnedBySelf,
        Require.permission('MAILSERVER_USE').or().anyVisibility({
            key: 'mailingListOwnerVisibilities',
            errorMessage: 'Bare eierne av en e-postliste ser e-postlistene',
        }),
    ).filter(({ session }) => ({ ownerVisibility: visibilityFilter(session.memberships) })),
    readTraversal: Require.allOf(readsMailingList, marksOwnedBySelf),
    readVisibility: readsMailingList,
    update: ownsMailingList,
    updateVisibility: ownsMailingList,
    destroy: ownsMailingList,
} as const
