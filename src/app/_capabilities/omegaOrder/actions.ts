'use server'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { makeAction } from '@/services/serverAction'

export const createOmegaOrderAction = makeAction(omegaOrderOperations.create)
