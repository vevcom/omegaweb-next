'use server'

import { makeAction } from '@/services/serverAction'
import { lockerLocationOperations } from '@/services/lockers/locations/operations'
import { lockerOperations } from '@/services/lockers/operations'
import { lockerReservationOperations } from '@/services/lockers/reservations/operations'

export const createLockerLocationAction = makeAction(lockerLocationOperations.create)
export const readAllLockerLocationsAction = makeAction(lockerLocationOperations.readAll)

export const createLockerAction = makeAction(lockerOperations.create)
export const readLockerPageAction = makeAction(lockerOperations.readPage)

export const updateLockerReservationAction = makeAction(lockerReservationOperations.update)
export const createLockerReservationAction = makeAction(lockerReservationOperations.create)
