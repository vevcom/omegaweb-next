import { Require } from '@/auth/authorizer/Require'

export const specialNotificationChannelAuth = {
    readChannel: Require.user(),
    readMany: Require.user(),
} as const
