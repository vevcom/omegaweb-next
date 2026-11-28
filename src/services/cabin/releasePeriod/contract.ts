import { cabinReleasePeriodDataFieldSchemas, cabinReleasePeriodParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { dateLessThan } from '@/lib/dates/comparison'
import { defineContract } from '@/services/serviceContract'

const releasePeriod = cabinReleasePeriodDataFieldSchemas.pick({
    releaseTime: true,
    releaseUntil: true,
}).refine(
    data => dateLessThan(data.releaseTime, data.releaseUntil),
    'Slipptiden må være før slutten av perioden som slippes.',
)

const releasePeriodId = cabinReleasePeriodParamsFieldSchemas.pick({
    id: true,
})

export const cabinReleasePeriodContract = defineContract({
    create: {
        data: releasePeriod,
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    destroy: {
        params: releasePeriodId,
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    readMany: {
        authorizer: Require.permission('CABIN_USE'),
    },
    getCurrentReleasePeriod: {
        authorizer: Require.permission('CABIN_ADMIN'),
    },
    update: {
        params: releasePeriodId,
        data: releasePeriod,
        authorizer: Require.permission('CABIN_ADMIN'),
    },
})
