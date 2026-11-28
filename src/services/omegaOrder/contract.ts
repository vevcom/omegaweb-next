import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

export const omegaOrderContract = defineContract({
    create: {
        authorizer: Require.permission('OMEGA_ORDER_ADMIN'),
    },
    readCurrent: {
        authorizer: Require.permission('OMEGA_ORDER_USE'),
    },
    readRequirements: {
        authorizer: Require.permission('OMEGA_ORDER_USE'),
    },
    readAll: {
        authorizer: Require.permission('OMEGA_ORDER_USE'),
    },
})
