import { Require } from '@/auth/authorizer/Require'

export const mailAddressExternalAuth = {
    create: Require.permission('MAILSERVER_ADMIN'),
    destroy: Require.permission('MAILSERVER_ADMIN'),
    readMany: Require.permission('MAILSERVER_USE'),
    read: Require.permission('MAILSERVER_USE'),
    update: Require.permission('MAILSERVER_ADMIN'),
} as const
