import { createSelection } from '@/services/createSelection'
import { userBasicSelection } from '@/services/users/constants'
import { DateTime } from 'luxon'
import type { Booking } from '@/prisma-generated-pn-types'

export const cabinBookingFieldsToExpose = ['start', 'end', 'type'] as const satisfies (keyof Booking)[]

export const cabinBookingFilterSelection = createSelection(cabinBookingFieldsToExpose)

export const cabinBookingIncluder = {
    user: {
        select: userBasicSelection,
    },
    BookingProduct: {
        include: {
            product: true,
        }
    },
    event: true,
    guestUser: true,
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
