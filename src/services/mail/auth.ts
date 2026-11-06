import { Require } from '@/auth/authorizer/Require'

const isActiveMemberOf = (memberships: { groupId: number, active: boolean }[], groupId: number) =>
    memberships.some(membership => membership.groupId === groupId && membership.active)

export const mailAuth = {
    createAliasMailingListRelation: Require.permission('MAILSERVER_ADMIN'),
    createMailingListExternalRelation: Require.permission('MAILSERVER_ADMIN'),
    createMailingListUserRelation: Require.permission('MAILSERVER_ADMIN'),
    createMailingListGroupRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyAliasMailingListRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyMailingListExternalRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyMailingListUserRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyMailingListGroupRelation: Require.permission('MAILSERVER_ADMIN'),
    readGroupTraversal: Require.permission('MAILSERVER_USE').or().custom<{ groupId: number }>(
        ({ session, groupId }) => isActiveMemberOf(session.memberships, groupId),
        { errorMessage: 'Bare medlemmer av gruppen ser hvor e-posten dens kommer fra' },
    ),
    readUserTraversal: Require.permission('MAILSERVER_USE').or().userId({
        errorMessage: 'Bare brukeren selv ser hvor e-posten deres kommer fra',
    }),
    readMailOptions: Require.permission('MAILSERVER_USE').or().user(),
} as const
