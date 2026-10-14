import { Require } from '@/auth/authorizer/Require'

export const notificationChannelAuth = {
    create: Require.permission('NOTIFICATION_ADMIN'),
    readMany: Require.user(),
    readDefault: Require.user(),
    update: Require.permission('NOTIFICATION_ADMIN'),
    destroy: Require.permission('NOTIFICATION_ADMIN'),
} as const
