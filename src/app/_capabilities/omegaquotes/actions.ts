'use server'
import { omegaquoteOperations } from '@/services/omegaquotes/operations'
import { makeAction } from '@/services/serverAction'

export const createQuoteAction = makeAction(omegaquoteOperations.create)
export const readQuotesPageAction = makeAction(omegaquoteOperations.readPage)
