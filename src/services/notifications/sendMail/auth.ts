import { Require } from '@/auth/authorizer/Require'

export const sendMailAuth = {
    readPage: Require.allOf(
        Require.permission('MAIL_USE'),
        Require.permission('MAILSERVER_ADMIN').or().anyVisibility({
            key: 'aliasOwnerVisibilities',
            errorMessage: 'Du eier ingen alias å sende fra',
        }),
    ),
    /**
     * MAIL_USE sends from an alias they own, so a committee writes from its own address; MAILSERVER_ADMIN
     * sends from any alias. Owning an alias alone sends nothing, and neither does administrating the
     * server without MAIL_USE.
     */
    sendMailFromAlias: Require.allOf(
        Require.permission('MAIL_USE'),
        Require.permission('MAILSERVER_ADMIN').or().visibility({
            errorMessage: 'Du kan bare sende fra et alias du eier',
        }),
    ),
} as const
