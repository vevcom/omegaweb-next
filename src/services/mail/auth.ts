import { Require } from '@/auth/authorizer/Require'

export const mailAuth = {
    createAliasMailingListRelation: Require.permission('MAILSERVER_ADMIN'),
    createMailingListExternalRelation: Require.permission('MAILSERVER_ADMIN'),
    createMailingListUserRelation: Require.permission('MAILSERVER_ADMIN'),
    createMailingListGroupRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyAliasMailingListRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyMailingListExternalRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyMailingListUserRelation: Require.permission('MAILSERVER_ADMIN'),
    destroyMailingListGroupRelation: Require.permission('MAILSERVER_ADMIN'),
    readMailFlow: Require.permission('MAILSERVER_USE'),
    readMailOptions: Require.permission('MAILSERVER_USE'),
} as const
