import { Require } from '@/auth/authorizer/Require'

export const omegaOrderAuth = {
    create: Require.permission('OMEGA_ORDER_ADMIN'),
    readCurrent: Require.permission('OMEGA_ORDER_USE'),
    readRequirements: Require.permission('OMEGA_ORDER_USE'),
    readAll: Require.permission('OMEGA_ORDER_USE')
} as const
