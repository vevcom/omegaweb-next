import { Require } from '@/auth/authorizer/Require'

export const lockerReservationAuth = {
    create: Require.permission('LOCKER_USE'),
    read: Require.permission('LOCKER_USE'),
    update: Require.permission('LOCKER_USE'),
} as const
