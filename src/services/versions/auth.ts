import { Require } from '@/auth/authorizer/Require'

export const versionsAuth = {
    readCurrent: Require.nothing(),
    readAll: Require.nothing(),
    readRepositoryUrl: Require.nothing(),
} as const
