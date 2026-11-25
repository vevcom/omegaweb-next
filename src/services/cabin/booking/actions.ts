'use server'
import { cabinBookingOperations } from './operations'
import { makeAction } from '@/services/serverAction'

export const createCabinBookingUserAttachedAction = makeAction(cabinBookingOperations.createCabinBookingUserAttached)
export const createBedBookingUserAttachedAction = makeAction(cabinBookingOperations.createBedBookingUserAttached)
export const createCabinBookingPaymentAction = makeAction(cabinBookingOperations.createPayment)

export const updateSpecialCmsParagraphCabinContractAction = makeAction(cabinBookingOperations.contract.updateContent)
export const releaseCabinBookingReservationAction = makeAction(cabinBookingOperations.releaseReservation)
export const cancelCabinBookingAction = makeAction(cabinBookingOperations.cancel)
export const cancelCabinBookingAsAdminAction = makeAction(cabinBookingOperations.cancelAsAdmin)
export const connectCabinToLedgerAccountAction = makeAction(cabinBookingOperations.connectToLedgerAccount)
