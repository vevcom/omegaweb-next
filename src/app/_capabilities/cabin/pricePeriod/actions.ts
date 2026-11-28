'use server'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { makeAction } from '@/services/serverAction'

export const createPricePeriodAction = makeAction(cabinPricePeriodOperations.create)
export const destroyPricePeriodAction = makeAction(cabinPricePeriodOperations.destroy)
export const updatePricePeriodAction = makeAction(cabinPricePeriodOperations.update)
