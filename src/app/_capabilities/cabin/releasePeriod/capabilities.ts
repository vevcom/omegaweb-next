import { createReleasePeriodAction, destroyReleasePeriodAction, updateReleasePeriodAction } from './actions'
import { cabinReleasePeriodContract } from '@/services/cabin/releasePeriod/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const cabinReleasePeriodCapabilities = defineCapabilities(cabinReleasePeriodContract, {
    create: createReleasePeriodAction,
    destroy: destroyReleasePeriodAction,
    update: updateReleasePeriodAction,
})
