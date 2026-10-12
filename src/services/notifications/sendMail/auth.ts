import { Require } from '@/auth/authorizer/Require'

export const sendMailAuth = {
    sendMail: Require.permission('MAIL_USE'),
} as const
