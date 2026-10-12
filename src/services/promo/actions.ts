'use server'
import { makeAction } from '@/services/serverAction'
import { promoOperations } from '@/services/promo/operations'

export const createPromoAction = makeAction(promoOperations.create)
export const updatePromoAction = makeAction(promoOperations.update)
export const destroyPromoAction = makeAction(promoOperations.destroy)

export const updatePromoImageAction = makeAction(promoOperations.updateImage)
