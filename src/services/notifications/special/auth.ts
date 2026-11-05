import { Require } from '@/auth/authorizer/Require'

export const specialNotificationAuth = {
    readChannel: Require.user(),
    readManyChannels: Require.user(),
} as const
