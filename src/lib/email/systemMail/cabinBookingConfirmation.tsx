import '@pn-server-only'
import { CabinBookingConfirmationTemplate } from '@/lib/email/templates/cabinBookingConfirmation'
import { sendMailOperations } from '@/services/notifications/sendMail/operations'
import type { Booking } from '@/prisma-generated-pn-types'

export type ConfirmedBooking = Pick<Booking, 'start' | 'end' | 'numberOfMembers' | 'numberOfNonMembers' | 'totalPrice'>

/**
 * Confirms a paid cabin booking to whoever made it - a user or a guest. It follows from the booking
 * itself, so it is system mail: not a notification channel the booker could have unsubscribed from.
 */
export async function sendCabinBookingConfirmationMail(
    recipient: { email: string, firstname: string },
    booking: ConfirmedBooking,
) {
    await sendMailOperations.internal.sendSystemMail.internalCall({
        data: {
            to: recipient.email,
            subject: 'Bekreftelse på hyttebooking',
            body: <CabinBookingConfirmationTemplate firstname={recipient.firstname} booking={booking} />,
        },
    })
}
