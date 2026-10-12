'use server'

import { ledgerAccountOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createLedgerAccountAction = makeAction(ledgerAccountOperations.create)
export const readLedgerAccountPageAction = makeAction(ledgerAccountOperations.readPage)
export const updateLedgerAccountAction = makeAction(ledgerAccountOperations.update)

