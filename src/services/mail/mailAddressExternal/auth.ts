import { Require } from '@/auth/authorizer/Require'

/**
 * External addresses have no owners: they are the pool any list owner may pick from. Reading them
 * takes a mail server permission, since an operation's authorizer cannot tell whether the session
 * owns a list. Only MAILSERVER_ADMIN changes them.
 */
const readsExternalAddresses = Require.permission('MAILSERVER_USE')
    .or()
    .permission('MAIL_ALIAS_CREATE')
    .or()
    .permission('MAIL_LIST_CREATE')

export const mailAddressExternalAuth = {
    create: Require.permission('MAILSERVER_ADMIN'),
    destroy: Require.permission('MAILSERVER_ADMIN'),
    readMany: readsExternalAddresses,
    readTraversal: readsExternalAddresses,
    update: Require.permission('MAILSERVER_ADMIN'),
} as const
