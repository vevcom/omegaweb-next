'use server'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
import { makeAction } from '@/services/serverAction'

export const resolveManualReviewAction = makeAction(manualReviewOperations.resolve)
