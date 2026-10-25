'use server'

import { ledgerTransactionOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const readLedgerTransactionPageAction = makeAction(ledgerTransactionOperations.readPage)
export const readLedgerTransactionStateByPaymentAction = makeAction(ledgerTransactionOperations.readStateByPayment)
export const cancelLedgerTransactionAction = makeAction(ledgerTransactionOperations.cancelOwn)
