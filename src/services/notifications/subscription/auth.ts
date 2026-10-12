import { Require } from '@/auth/authorizer/Require'

const userIdOrNotificationAdmin = Require.permission('NOTIFICATION_ADMIN').or().userId()

export const notificationSubscriptionAuth = {
    read: userIdOrNotificationAdmin,
    update: userIdOrNotificationAdmin,
} as const
