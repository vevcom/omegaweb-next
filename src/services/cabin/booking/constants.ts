import { createSelection } from '@/services/createSelection'
import { userBasicSelection } from '@/services/users/constants'
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

