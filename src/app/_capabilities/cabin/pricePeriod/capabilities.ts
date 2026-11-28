import { createPricePeriodAction, destroyPricePeriodAction, updatePricePeriodAction } from './actions'
import { cabinPricePeriodContract } from '@/services/cabin/pricePeriod/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const cabinPricePeriodCapabilities = defineCapabilities(cabinPricePeriodContract, {
    create: createPricePeriodAction,
    destroy: destroyPricePeriodAction,
    update: updatePricePeriodAction,
})
