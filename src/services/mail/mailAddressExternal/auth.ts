import { Require } from '@/auth/authorizer/Require'
import { marksOwnedBySelf } from '@/services/mail/auth'

/**
 * External addresses have no owners: they are the pool any list owner may pick from. Reading them
 * takes a mail server permission, since an operation's authorizer cannot tell whether the session
 * owns a list, which also makes it what the admin navs offer the mail server pages on. Only
 * MAILSERVER_ADMIN changes them.
 */
const readsExternalAddresses = Require.permission('MAILSERVER_USE')
    .or()
    .permission('MAILSERVER_ADMIN')
    .or()
    .permission('MAIL_ALIAS_CREATE')
    .or()
    .permission('MAIL_LIST_CREATE')

export const mailAddressExternalAuth = {
    create: Require.permission('MAILSERVER_ADMIN'),
    destroy: Require.permission('MAILSERVER_ADMIN'),
    readMany: readsExternalAddresses,
    readTraversal: Require.allOf(readsExternalAddresses, marksOwnedBySelf),
    update: Require.permission('MAILSERVER_ADMIN'),
} as const
