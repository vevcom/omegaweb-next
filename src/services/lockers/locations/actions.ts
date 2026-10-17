'use server'
import { lockerLocationOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createLockerLocationAction = makeAction(lockerLocationOperations.create)
export const updateLockerLocationAction = makeAction(lockerLocationOperations.update)
export const destroyLockerLocationAction = makeAction(lockerLocationOperations.destroy)
