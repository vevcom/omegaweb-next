import { Require } from '@/auth/authorizer/Require'

export const dotFreezePeriodAuth = {
    create: Require.permission('DOTS_ADMIN'),
    readAll: Require.user(),
    update: Require.permission('DOTS_ADMIN'),
    destroy: Require.permission('DOTS_ADMIN'),
} as const
