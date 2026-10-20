import { Require } from '@/auth/authorizer/Require'

export const browserPushSubscriptionAuth = {
    create: Require.userId(),
    destroy: Require.userId(),
} as const
