import { Require } from '@/auth/authorizer/Require'

export const screenAuth = {
    create: Require.permission('SCREEN_ADMIN'),
    destroy: Require.permission('SCREEN_ADMIN'),
    read: Require.permission('SCREEN_USE'),
    readAll: Require.permission('SCREEN_USE'),
    update: Require.permission('SCREEN_ADMIN'),
    movePage: Require.permission('SCREEN_ADMIN'),
} as const
