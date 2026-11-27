import { createQuoteAction } from './actions'
import { omegaquoteContract } from '@/services/omegaquotes/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const omegaquoteCapabilities = defineCapabilities(omegaquoteContract, {
    create: createQuoteAction,
})
