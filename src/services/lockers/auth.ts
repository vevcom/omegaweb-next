import { Require } from '@/auth/authorizer/Require'

export const lockerAuth = {
    create: Require.permission('LOCKER_ADMIN'),
    read: Require.permission('LOCKER_USE'),
    readPage: Require.permission('LOCKER_USE'),
    update: Require.permission('LOCKER_ADMIN'),
    destroy: Require.permission('LOCKER_ADMIN'),
} as const
