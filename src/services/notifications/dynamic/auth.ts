import { Require } from '@/auth/authorizer/Require'

export const dynamicNotificationAuth = {
    createChannel: Require.permission('NOTIFICATION_ADMIN'),
    readManyChannels: Require.user(),
    updateChannel: Require.permission('NOTIFICATION_ADMIN'),
    destroyChannel: Require.permission('NOTIFICATION_ADMIN'),
    createNotification: Require.permission('NOTIFICATION_ADMIN'),
} as const
