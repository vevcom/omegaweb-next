import '@pn-server-only'

import { displayDate } from '@/lib/dates/displayDate'
import { displayAmount } from '@/lib/currency/convert'
import { Html } from '@react-email/components'
import type { ConfirmedBooking } from '@/lib/email/systemMail/cabinBookingConfirmation'

export function CabinBookingConfirmationTemplate({
    firstname,
    booking,
}: {
    firstname: string,
    booking: ConfirmedBooking,
}) {
    return (
        <Html>
            <p>Hei {firstname},</p>

            <p>
                Takk for bookingen din hos {process.env.WEBSITE_DOMAIN}. Betalingen er mottatt, og bookingen er
                bekreftet.
            </p>

            <ul>
                <li>Fra: {displayDate(booking.start, false)}</li>
                <li>Til: {displayDate(booking.end, false)}</li>
                <li>Antall medlemmer: {booking.numberOfMembers}</li>
                <li>Antall ikke-medlemmer: {booking.numberOfNonMembers}</li>
                <li>Pris: {displayAmount(booking.totalPrice, false)}</li>
            </ul>

            <p>
                Med vennlig hilsen<br/>
                HeutteCom
            </p>
        </Html>
    )
}
