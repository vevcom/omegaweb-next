import CancelCabinBookingForm from './CancelCabinBookingForm'
import { describeBooking } from '@/app/(omegaweb)/admin/cabin-booking/bookingLabels'
import { freeCancellationDeadline } from '@/services/cabin/booking/constants'
import { displayAmount } from '@/lib/currency/convert'
import { displayDate } from '@/lib/dates/displayDate'
import type { cabinBookingOperations } from '@/services/cabin/booking/operations'

type Booking = Awaited<ReturnType<typeof cabinBookingOperations.readManyOfUser>>[number]

const dayMs = 24 * 60 * 60 * 1000

function BookingStatus({ booking, now }: { booking: Booking, now: Date }) {
    if (booking.canceled) {
        const refunded = booking.ledgerTransactions.some(transaction => transaction.refundOf !== null)
        return <span>{refunded ? 'Avbestilt, beløpet er satt inn på Omega-kontoen' : 'Avbestilt'}</span>
    }
    if (booking.end <= now) return <span>Fullført</span>
    if (booking.transactionTimeout) return <span className="text-warning">Betalingen behandles</span>

    const deadline = freeCancellationDeadline(booking.start)
    if (deadline < now) {
        return <span>Betalt. Avbestilling nå må avtales med hyttestyret.</span>
    }
    return <>
        <span className="text-success">Betalt. Gratis avbestilling til {displayDate(deadline, false)}.</span>
        <CancelCabinBookingForm bookingId={booking.id} />
    </>
}

export default function CabinBookingRow({ booking, now }: { booking: Booking, now: Date }) {
    return <div className="list-row">
        <div className="list-row-main">
            <h2>
                {displayDate(booking.start, false)} – {displayDate(booking.end, false)}
            </h2>
            <p>
                {describeBooking(booking)}
                {' · '}
                {Math.round((booking.end.getTime() - booking.start.getTime()) / dayMs)} netter
                {booking.type === 'CABIN' && (
                    <> · {booking.numberOfMembers} medlemmer, {booking.numberOfNonMembers} andre</>
                )}
            </p>
            <BookingStatus booking={booking} now={now} />
        </div>
        <div className="list-row-meta">
            <span>{displayAmount(booking.totalPrice)}</span>
            <span>#{booking.id}</span>
        </div>
    </div>
}
