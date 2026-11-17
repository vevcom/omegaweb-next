import { Require } from '@/auth/authorizer/Require'

export const revueFrontpageAuth = {
    mainRevueInfo: {
        read: Require.nothing(),
        update: Require.permission('REVUE_ADMIN'),
    },
} as const
