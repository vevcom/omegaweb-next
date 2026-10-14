'use server'
import { lockerReservationOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createLockerReservationAction = makeAction(lockerReservationOperations.create)
export const updateLockerReservationAction = makeAction(lockerReservationOperations.update)
