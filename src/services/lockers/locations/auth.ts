import { Require } from '@/auth/authorizer/Require'

export const lockerLocationAuth = {
    create: Require.permission('LOCKER_ADMIN'),
    readAll: Require.nothing(),
    update: Require.permission('LOCKER_ADMIN'),
    destroy: Require.permission('LOCKER_ADMIN'),
} as const
