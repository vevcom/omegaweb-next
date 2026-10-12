import { Require } from '@/auth/authorizer/Require'

export const lockerAuth = {
    create: Require.permission('LOCKER_ADMIN'),
    read: Require.permission('LOCKER_USE'),
    readPage: Require.permission('LOCKER_USE'),
} as const
