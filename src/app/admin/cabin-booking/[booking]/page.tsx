import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { serverPage } from '@/app/serverPage'
import { displayDate } from '@/lib/dates/displayDate'
import { formatVevenUri } from '@/lib/urlEncoding'
import Link from 'next/link'
import React from 'react'
import type { PageOperationArgs } from '@/app/serverPage'

function trHelper(key: string, value: React.ReactNode) {
    return <tr>
        <th>{key}</th>
        <td>{value}</td>
    </tr>
}

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ booking: string }>) =>
        cabinBookingOperations.read({
            params: { id: parseInt(decodeURIComponent(params.booking), 10) },
        }),
    metadata: () => ({ title: 'Booking' }),
    render: ({ data: booking }) => (
        <PageWrapper>
            <table>
                <tbody>
                    {trHelper('ID', booking.id)}
                    {trHelper('Start', displayDate(booking.start, false))}
                    {trHelper('Slutt', displayDate(booking.end, false))}
                    {trHelper('Antall medlemmer', booking.numberOfMembers)}
                    {trHelper('Antall eksterne', booking.numberOfNonMembers)}
                    {trHelper('Interne notater', booking.notes)}
                    {trHelper('Notater fra leietaker', booking.tenantNotes)}
                    {trHelper('Type', booking.type)}
                    {booking.user &&
                        trHelper('Leietaker', <Link
                            href={`/users/${booking.user.username}`}
                        >
                            {booking.user.firstname} {booking.user.lastname}
                        </Link>)
                    }
                    {booking.event &&
                        trHelper('Arrangement', <Link
                            href={`/event/${formatVevenUri(booking.event.name, booking.event.id)}`}
                        >
                            {booking.event.name}
                        </Link>)
                    }
                    {booking.guestUser && <>
                        { trHelper('Gjest', `${booking.guestUser.firstname} ${booking.guestUser.lastname}`) }
                        { trHelper('E-post', booking.guestUser.email) }
                        { trHelper('Telefonnummer', booking.guestUser.mobile) }
                    </>}
                </tbody>
            </table>

            <SimpleTable
                header={[
                    'Produkt',
                    'Antall'
                ]}
                body={booking.BookingProduct.map(product => [
                    product.product.name,
                    product.quantity
                ])}
            />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
