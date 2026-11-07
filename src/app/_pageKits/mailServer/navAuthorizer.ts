import { Require } from '@/auth/authorizer/Require'

/**
 * What an admin nav offers the mail server pages on: the mail server permissions. The pages are
 * read by the owners of an alias or a list too, but a nav cannot know what the viewer owns, so
 * owners without a permission reach the pages by link.
 */
export const mailServerNavAuthorizer = Require.permission('MAILSERVER_USE')
    .or()
    .permission('MAILSERVER_ADMIN')
    .or()
    .permission('MAIL_ALIAS_CREATE')
    .or()
    .permission('MAIL_LIST_CREATE')
