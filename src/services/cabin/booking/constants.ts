import { createSelection } from '@/services/createSelection'
import { userBasicSelection } from '@/services/users/constants'
import { DateTime } from 'luxon'
import type { Booking, LedgerTransaction } from '@/prisma-generated-pn-types'

export const cabinBookingFieldsToExpose = ['start', 'end', 'type'] as const satisfies (keyof Booking)[]

export const cabinBookingFilterSelection = createSelection(cabinBookingFieldsToExpose)

export const cabinBookingIncluder = {
    user: {
        select: { ...userBasicSelection, email: true, mobile: true },
    },
    BookingProduct: {
        include: {
            product: true,
        }
    },
    event: true,
    guestUser: true,
    ledgerTransactions: {
        select: { purpose: true, state: true, refundOf: { select: { id: true } } },
    },
}

// How long a reserved booking blocks the calendar before payment must be started.
export const cabinReservationWindowMs = 10 * 60 * 1000

// The longest stay one booking may cover.
export const maxCabinBookingNights = 14

// How many reservations one booker may hold unpaid at a time, so dates cannot be kept blocked by
// reserving over and over without paying.
export const maxUnpaidReservationsPerBooker = 2

// How many days before check-in a user may still cancel a paid booking and get the price back.
export const cabinFreeCancellationDays = 21

/**
 * The last moment a booking starting on `start` may be canceled for free. `start` is a date stored
 * as UTC midnight, and check-in counts from midnight in Oslo.
 */
export const freeCancellationDeadline = (start: Date) => DateTime
    .fromISO(start.toISOString().slice(0, 10), { zone: 'Europe/Oslo' })
    .minus({ days: cabinFreeCancellationDays })
    .toJSDate()

export type CabinBookingStatus = 'CANCELED' | 'BLOCKED' | 'PAID' | 'PROCESSING' | 'AWAITING_PAYMENT' | 'EXPIRED'

/**
 * Where a booking stands. A paid booking keeps its payment window until the payment completion
 * worker has confirmed it, which is PROCESSING.
 */
export function cabinBookingStatus(
    booking: Pick<Booking, 'type' | 'canceled' | 'transactionTimeout'> & {
        ledgerTransactions: Pick<LedgerTransaction, 'purpose' | 'state'>[],
    },
    now: Date,
): CabinBookingStatus {
    if (booking.canceled) return 'CANCELED'
    if (booking.type === 'EVENT') return 'BLOCKED'
    const paid = booking.ledgerTransactions.some(
        transaction => transaction.purpose === 'CABIN_BOOKING' && transaction.state === 'SUCCEEDED'
    )
    if (paid) return booking.transactionTimeout ? 'PROCESSING' : 'PAID'
    return booking.transactionTimeout && booking.transactionTimeout > now ? 'AWAITING_PAYMENT' : 'EXPIRED'
}
