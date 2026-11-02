import { Require } from '@/auth/authorizer/Require'

export const revueAuth = {
    readMainRevueInfo: Require.nothing(),
    updateMainRevueInfo: Require.permission('REVUE_ADMIN'),
} as const
