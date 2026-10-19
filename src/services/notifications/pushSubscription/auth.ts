import { Require } from '@/auth/authorizer/Require'

export const pushSubscriptionAuth = {
    create: Require.userId(),
    destroy: Require.userId(),
} as const
