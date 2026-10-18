'use server'

import { ledgerTransactionOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readLedgerTransactionPageAction = makeAction(ledgerTransactionOperations.readPage)
export const cancelLedgerTransactionAction = makeAction(ledgerTransactionOperations.cancel)
export const resolveManualReviewAction = makeAction(ledgerTransactionOperations.resolveManualReview)
