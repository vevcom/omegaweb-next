import { Require } from '@/auth/authorizer/Require'

export const notificationAuth = {
    create: Require.permission('NOTIFICATION_ADMIN'),
} as const
