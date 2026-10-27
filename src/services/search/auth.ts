import { Require } from '@/auth/authorizer/Require'

export const searchAuth = {
    // Each category's own search operation decides whether the session may search it.
    search: Require.nothing(),
} as const
