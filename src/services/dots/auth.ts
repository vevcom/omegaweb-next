import { Require } from '@/auth/authorizer/Require'

export const dotAuth = {
    create: Require.userId().permission('DOTS_ADMIN'),
    update: Require.permission('DOTS_ADMIN'),
    destroy: Require.permission('DOTS_ADMIN'),
    readForUser: Require.permission('DOTS_ADMIN').or().userId(),
} as const
