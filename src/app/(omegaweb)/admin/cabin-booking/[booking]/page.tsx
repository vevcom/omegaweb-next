import CancelBookingForm from './CancelBookingForm'
import {
    bookerName,
    describeBooking,
    statusClassNames,
    statusLabels,
} from '@/app/(omegaweb)/admin/cabin-booking/bookingLabels'
import { cabinAdminBadgeClassName, cabinAdminCardClassName } from '@/app/(omegaweb)/admin/cabinAdminStyles'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { cabinBookingStatus } from '@/services/cabin/booking/constants'
import { cabinBookingAuth } from '@/services/cabin/booking/auth'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/ServerPage'
import { displayDate } from '@/lib/dates/displayDate'
import { displayAmount } from '@/lib/currency/convert'
import { formatVevenUri } from '@/lib/urlEncoding'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import type { ReactNode } from 'react'
import type { PageOperationArgs } from '@/app/ServerPage'

function Field({ label, children }: { label: string, children: ReactNode }) {
    return <div>
        <dt className="text-s text-base-content/80">{label}</dt>
        <dd className="m-0">{children}</dd>
    </div>
}

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ booking: string }>) => {
        const booking = await cabinBookingOperations.read({
            params: { id: parseInt(decodeURIComponent(params.booking), 10) },
        })
        return { booking, status: cabinBookingStatus(booking, new Date()) }
    },
    capabilities: () => ({
        canCancel: cabinBookingAuth.cancelAsAdmin,
    }),
    metadata: ({ booking }) => ({ title: `Booking #${booking.id}` }),
    render: ({ data: { booking, status }, capabilities }) => {
        const person = booking.user ?? booking.guestUser
        const refunded = booking.ledgerTransactions.some(transaction => transaction.refundOf !== null)

        return <PageWrapper>
            <div className="flex flex-col gap-6 max-w-4xl">
                <SiteLink href={appHref('/admin/cabin-booking')}>← Alle bookinger</SiteLink>

                <section className={cabinAdminCardClassName}>
                    <div className="flex flex-wrap justify-between items-start gap-3">
                        <div>
                            <h2 className="m-0">{bookerName(booking)}</h2>
                            <p className="m-0">
                                {displayDate(booking.start, false)} – {displayDate(booking.end, false)}
                                {' · '}{describeBooking(booking)}
                            </p>
                        </div>
                        <span className={`
                            ${cabinAdminBadgeClassName}
                            ${statusClassNames[status]}
                        `}>
                            {statusLabels[status]}{refunded && ', refundert'}
                        </span>
                    </div>
                    <dl className="
                        m-0 grid grid-cols-3 gap-4
                        max-mobile:grid-cols-1
                    ">
                        <Field label="Pris">{booking.totalPrice ? displayAmount(booking.totalPrice, false) : '–'}</Field>
                        {booking.type === 'CABIN' && <Field label="Personer">
                            {booking.numberOfMembers} medlemmer, {booking.numberOfNonMembers} andre
                        </Field>}
                        <Field label="Booket">{displayDate(booking.createdAt)}</Field>
                    </dl>
                </section>

                <section className={cabinAdminCardClassName}>
                    <h3 className="m-0">Leietaker</h3>
                    <dl className="
                        m-0 grid grid-cols-3 gap-4
                        max-mobile:grid-cols-1
                    ">
                        {booking.user && <Field label="Medlem">
                            <SiteLink href={appHref(`/users/${booking.user.username}`)}>
                                {booking.user.firstname} {booking.user.lastname}
                            </SiteLink>
                        </Field>}
                        {booking.guestUser && <Field label="Gjest">
                            {booking.guestUser.firstname} {booking.guestUser.lastname}
                        </Field>}
                        {booking.event && <Field label="Arrangement">
                            <SiteLink href={appHref(`/event/${formatVevenUri(booking.event.name, booking.event.id)}`)}>
                                {booking.event.name}
                            </SiteLink>
                        </Field>}
                        {person && <Field label="E-post">{person.email}</Field>}
                        {person && <Field label="Telefon">{person.mobile ?? 'Ikke oppgitt'}</Field>}
                    </dl>
                    <Field label="Beskjed fra leietaker">{booking.tenantNotes || '–'}</Field>
                    {booking.notes && <Field label="Interne notater">{booking.notes}</Field>}
                </section>

                {capabilities.canCancel.authorized && status !== 'CANCELED' && status !== 'EXPIRED' &&
                    <section className={cabinAdminCardClassName}>
                        <h3 className="m-0">Avbestill</h3>
                        <CancelBookingForm
                            bookingId={booking.id}
                            paid={status === 'PAID'}
                            guest={booking.userId === null}
                        />
                    </section>
                }
            </div>
        </PageWrapper>
    },
})

export default page
export { generateMetadata }
