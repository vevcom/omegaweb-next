import { Require } from '@/auth/authorizer/Require'

export const lockerLocationAuth = {
    create: Require.permission('LOCKER_ADMIN'),
    readAll: Require.nothing(),
} as const
