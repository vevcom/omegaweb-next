import { Require } from '@/auth/authorizer/Require'
import { visibilityFilter } from '@/auth/visibility/visibilityFilter'

/** A mailing list is read by those who pass its owner visibility; MAILSERVER_USE reads them all. */
const readsMailingList = Require.permission('MAILSERVER_USE').or().visibility({
    errorMessage: 'Bare eierne av e-postlisten ser den',
})

export const mailingListAuth = {
    create: Require.permission('MAILSERVER_ADMIN'),
    readMany: Require.permission('MAILSERVER_USE').or().user().filter(({ session }) => ({
        ownerVisibility: visibilityFilter(session.memberships),
    })),
    readTraversal: readsMailingList,
    readVisibility: readsMailingList,
    update: Require.permission('MAILSERVER_ADMIN'),
    updateVisibility: Require.permission('MAILSERVER_ADMIN'),
    destroy: Require.permission('MAILSERVER_ADMIN'),
} as const
