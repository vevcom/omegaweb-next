import { Require } from '@/auth/authorizer/Require'

export const cabinProductAuth = {
    create: Require.permission('CABIN_ADMIN'),
    createPrice: Require.permission('CABIN_ADMIN'),
    read: Require.permission('CABIN_USE'),
    readActive: Require.permission('CABIN_USE'),
    readMany: Require.permission('CABIN_USE'),
} as const
