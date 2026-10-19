'use server'
import { lockerOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createLockerAction = makeAction(lockerOperations.create)
export const readLockerPageAction = makeAction(lockerOperations.readPage)
export const updateLockerAction = makeAction(lockerOperations.update)
export const destroyLockerAction = makeAction(lockerOperations.destroy)
