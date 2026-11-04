import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { serverPage } from '@/app/ServerPage'
import { displayDate } from '@/lib/dates/displayDate'
import { formatVevenUri } from '@/lib/urlEncoding'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import React from 'react'
import type { PageOperationArgs } from '@/app/ServerPage'

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
                        trHelper('Leietaker', <SiteLink
                            href={appHref(`/users/${booking.user.username}`)}
                        >
                            {booking.user.firstname} {booking.user.lastname}
                        </SiteLink>)
                    }
                    {booking.event &&
                        trHelper('Arrangement', <SiteLink
                            href={appHref(`/event/${formatVevenUri(booking.event.name, booking.event.id)}`)}
                        >
                            {booking.event.name}
                        </SiteLink>)
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
