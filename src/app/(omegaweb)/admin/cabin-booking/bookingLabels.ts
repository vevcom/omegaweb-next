import type { CabinBookingStatus } from '@/services/cabin/booking/constants'
import type { BookingType } from '@/prisma-generated-pn-types'

export const statusLabels: Record<CabinBookingStatus, string> = {
    CANCELED: 'Avbestilt',
    BLOCKED: 'Sperret',
    PAID: 'Betalt',
    PROCESSING: 'Betaling behandles',
    AWAITING_PAYMENT: 'Venter på betaling',
    EXPIRED: 'Utløpt',
}

export const statusClassNames: Record<CabinBookingStatus, string> = {
    CANCELED: 'bg-base-300 text-base-content',
    BLOCKED: 'bg-base-300 text-base-content',
    PAID: 'bg-success text-success-content',
    PROCESSING: 'bg-info text-info-content',
    AWAITING_PAYMENT: 'bg-warning text-warning-content',
    EXPIRED: 'bg-base-300 text-base-content/80',
}

export function describeBooking(booking: {
    type: BookingType,
    BookingProduct: { quantity: number, product: { name: string } }[],
}) {
    if (booking.type === 'CABIN') return 'Hele hytta'
    if (booking.type === 'EVENT') return 'Arrangement'
    return booking.BookingProduct
        .map(bookingProduct => `${bookingProduct.quantity} × ${bookingProduct.product.name}`)
        .join(', ')
}

export function bookerName(booking: {
    user: { firstname: string, lastname: string } | null,
    guestUser: { firstname: string, lastname: string } | null,
    event: { name: string } | null,
}) {
    const person = booking.user ?? booking.guestUser
    if (person) return `${person.firstname} ${person.lastname}`
    return booking.event?.name ?? 'Ukjent'
}

export function bookerKind(booking: { user: unknown, guestUser: unknown }) {
    if (booking.user) return 'Medlem'
    if (booking.guestUser) return 'Gjest'
    return 'Sperret av hyttestyret'
}
