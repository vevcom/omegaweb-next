import { Require } from '@/auth/authorizer/Require'

export const specialNotificationChannelAuth = {
    read: Require.user(),
    readMany: Require.user(),
} as const
