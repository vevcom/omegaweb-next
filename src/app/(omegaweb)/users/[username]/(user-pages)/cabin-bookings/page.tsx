import CancelCabinBookingForm from './CancelCabinBookingForm'
import { describeBooking } from '@/app/(omegaweb)/admin/cabin-booking/bookingLabels'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { freeCancellationDeadline } from '@/services/cabin/booking/constants'
import { displayAmount } from '@/lib/currency/convert'
import { displayDate } from '@/lib/dates/displayDate'
import { serverPage } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

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

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'cabin-bookings', session)
        const bookings = await cabinBookingOperations.readManyOfUser({ params: { userId: profile.user.id } })
        return { bookings, now: new Date() }
    },
    metadata: () => ({ title: 'Hyttebookinger' }),
    render: ({ data: { bookings, now } }) => (
        <div className="min-h-full bg-base-100 rounded-round p-(--card-padding)">
            <h2>Hyttebookinger</h2>
            {bookings.length === 0 && (
                <p>
                    Du har ingen hyttebookinger.{' '}
                    <SiteLink href={appHref('/cabin/book')}>Book Heutten</SiteLink>
                </p>
            )}
            <div className="row-list">
                {bookings.map(booking => (
                    <div key={booking.id} className="list-row">
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
                ))}
            </div>
        </div>
    ),
})

export default page
export { generateMetadata }
