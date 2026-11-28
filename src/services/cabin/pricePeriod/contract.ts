import { cabinPricePeriodDataFieldSchemas, cabinPricePeriodParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

const pricePeriodId = cabinPricePeriodParamsFieldSchemas.pick({
    id: true,
})

export const cabinPricePeriodContract = defineContract({
    create: {
        data: cabinPricePeriodDataFieldSchemas.pick({
            validFrom: true,
            copyPreviousPrices: true,
        }),
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    destroy: {
        params: pricePeriodId,
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    readMany: {
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    readPublicPeriods: {
        authorizer: Require.permission('CABIN_USE'),
    },
    readUnreleasedPeriods: {
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    update: {
        params: pricePeriodId,
        data: cabinPricePeriodDataFieldSchemas.pick({
            validFrom: true,
        }),
        authorizer: Require.permission('CABIN_ADMIN'),
    },
})
