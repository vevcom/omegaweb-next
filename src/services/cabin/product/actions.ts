'use server'
import { cabinProductOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCabinProductAction = makeAction(cabinProductOperations.create)
export const createCabinProductPriceAction = makeAction(cabinProductOperations.createPrice)
