'use server'
import { makeAction } from '@/services/serverAction'
import { purchaseOperations } from '@/services/shop/purchase/operations'

export const createPurchaseAction = makeAction(purchaseOperations.create)
