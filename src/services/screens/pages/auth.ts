import { Require } from '@/auth/authorizer/Require'

export const screenPageAuth = {
    //TODO: Service not refactored to serviceoperations.... use these authorizers then.
    create: Require.permission('SCREEN_ADMIN'),
    destroy: Require.permission('SCREEN_ADMIN'),
    read: Require.permission('SCREEN_USE'),
    readAll: Require.permission('SCREEN_USE'),
    update: Require.permission('SCREEN_ADMIN'),
} as const
