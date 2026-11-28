import { createDotFreezePeriodAction, destroyDotFreezePeriodAction, updateDotFreezePeriodAction } from './actions'
import { dotFreezePeriodContract } from '@/services/dots/freezePeriods/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const dotFreezePeriodCapabilities = defineCapabilities(dotFreezePeriodContract, {
    create: createDotFreezePeriodAction,
    update: updateDotFreezePeriodAction,
    destroy: destroyDotFreezePeriodAction,
})
