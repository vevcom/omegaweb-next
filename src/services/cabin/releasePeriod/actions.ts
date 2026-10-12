'use server'
import { cabinReleasePeriodOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createReleasePeriodAction = makeAction(cabinReleasePeriodOperations.create)
export const destroyReleasePeriodAction = makeAction(cabinReleasePeriodOperations.destroy)
