import { Require } from '@/auth/authorizer/Require'

export const careersSearchAuth = {
    // The search of each category decides whether the session may search it.
    searchAll: Require.nothing(),
} as const
