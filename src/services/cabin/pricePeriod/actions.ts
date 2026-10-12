'use server'
import { cabinPricePeriodOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createPricePeriodAction = makeAction(cabinPricePeriodOperations.create)
export const destroyPricePeriodAction = makeAction(cabinPricePeriodOperations.destroy)
