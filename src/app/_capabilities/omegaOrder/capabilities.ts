import { createOmegaOrderAction } from './actions'
import { omegaOrderContract } from '@/services/omegaOrder/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const omegaOrderCapabilities = defineCapabilities(omegaOrderContract, {
    create: createOmegaOrderAction,
})
