import { dotFreezePeriodDataFieldSchemas, dotFreezePeriodParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { defineContract } from '@/services/serviceContract'

const freezePeriod = dotFreezePeriodDataFieldSchemas.pick({
    start: true,
    end: true,
    reason: true,
}).refine(data => data.start < data.end, 'Frysperioden må slutte etter at den starter.')

const freezePeriodId = dotFreezePeriodParamsFieldSchemas.pick({
    id: true,
})

export const dotFreezePeriodContract = defineContract({
    create: {
        data: freezePeriod,
        authorizer: Require.permission('DOTS_ADMIN'),
    },
    readAll: {
        authorizer: Require.user(),
    },
    update: {
        params: freezePeriodId,
        data: freezePeriod,
        authorizer: Require.permission('DOTS_ADMIN'),
    },
    destroy: {
        params: freezePeriodId,
        authorizer: Require.permission('DOTS_ADMIN'),
    },
})
