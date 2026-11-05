import { Require } from '@/auth/authorizer/Require'

export const dynamicNotificationChannelAuth = {
    create: Require.permission('NOTIFICATION_ADMIN'),
    readMany: Require.user(),
    update: Require.permission('NOTIFICATION_ADMIN'),
    destroy: Require.permission('NOTIFICATION_ADMIN'),
    createNotification: Require.permission('NOTIFICATION_ADMIN'),
} as const
