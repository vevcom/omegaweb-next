import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import { serverPage } from '@/app/serverPage'
import { displayDate } from '@/lib/dates/displayDate'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('cabin-booking', session)
        return cabinBookingOperations.readMany({})
    },
    metadata: () => ({ title: 'Hytte bookinger' }),
    render: ({ data: bookings }) => {
        const displayNames = bookings.map(booking => {
            if (booking.user) {
                return `${booking.user.firstname} ${booking.user.lastname}`
            }

            if (booking.guestUser) {
                return `${booking.guestUser.firstname} ${booking.guestUser.lastname}`
            }

            return 'Ukjent'
        })

        return (
            <PageWrapper>
                <SimpleTable
                    header={['Navn', 'Type', 'Start', 'Slutt', 'Notater']}
                    body={bookings.map((booking, i) => [
                        displayNames[i],
                        booking.type,
                        displayDate(booking.start, false),
                        displayDate(booking.end, false),
                        booking.notes ?? ''
                    ])}
                    links={bookings.map(booking => `/admin/cabin-booking/${booking.id}`)}
                />
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
