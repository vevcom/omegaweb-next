'use server'
import { dotFreezePeriodOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createDotFreezePeriodAction = makeAction(dotFreezePeriodOperations.create)
export const updateDotFreezePeriodAction = makeAction(dotFreezePeriodOperations.update)
export const destroyDotFreezePeriodAction = makeAction(dotFreezePeriodOperations.destroy)
