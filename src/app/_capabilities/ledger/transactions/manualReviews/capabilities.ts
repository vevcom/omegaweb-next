import { resolveManualReviewAction } from './actions'
import { manualReviewContract } from '@/services/ledger/transactions/manualReviews/contract'
import { defineCapabilities } from '@/services/serviceContract'

export const manualReviewCapabilities = defineCapabilities(manualReviewContract, {
    resolve: resolveManualReviewAction,
})
