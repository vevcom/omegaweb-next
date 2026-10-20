import { Require } from '@/auth/authorizer/Require'

export const screenAuth = {
    create: Require.permission('SCREEN_ADMIN'),
    read: Require.permission('SCREEN_USE'),
    readMany: Require.permission('SCREEN_USE'),
    update: Require.permission('SCREEN_ADMIN'),
    updatePages: Require.permission('SCREEN_ADMIN'),
    destroy: Require.permission('SCREEN_ADMIN'),
} as const
