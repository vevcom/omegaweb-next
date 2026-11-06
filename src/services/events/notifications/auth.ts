import { eventAdminLevel } from '@/services/events/auth'
import { Require } from '@/auth/authorizer/Require'

export const eventNotificationAuth = {
    createNotification: eventAdminLevel,
    createPaymentReminder: eventAdminLevel,
    readManyChannels: Require.permission('EVENT_ADMIN'),
} as const
