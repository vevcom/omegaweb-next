import { Require } from '@/auth/authorizer/Require'

export const sendMailAuth = {
    /** From any address on our domains. */
    sendMail: Require.permission('MAIL_USE'),
    /** From an alias the sender owns, so a committee writes from its own address without the permission above. */
    sendMailFromAlias: Require.permission('MAIL_USE').or().visibility({
        errorMessage: 'Du kan bare sende fra et alias du eier',
    }),
} as const
