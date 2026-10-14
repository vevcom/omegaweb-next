'use server'
import { lockerLocationOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createLockerLocationAction = makeAction(lockerLocationOperations.create)
