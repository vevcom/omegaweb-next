import { Require } from '@/auth/authorizer/Require'

/** The sync sends in a space's channels. Nobody does by hand, short of those who run the notifications. */
export const chatSpaceNotificationAuth = {
    readManyChannels: Require.permission('NOTIFICATION_ADMIN'),
    createNotification: Require.permission('NOTIFICATION_ADMIN'),
} as const
