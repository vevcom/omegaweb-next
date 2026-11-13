import { bookerKind, bookerName, describeBooking, statusClassNames, statusLabels } from './bookingLabels'
import {
    cabinAdminBadgeClassName,
    cabinAdminCardClassName,
    cabinAdminTableClassName,
} from '@/app/(omegaweb)/admin/cabinAdminStyles'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { cabinBookingStatus } from '@/services/cabin/booking/constants'
import PageWrapper from '@/app/_components/PageWrapper/PageWrapper'
import SimpleTable from '@/app/_components/Table/SimpleTable'
import SiteLink from '@/components/SiteLink/SiteLink'
import { serverPage } from '@/app/ServerPage'
import { displayDate } from '@/lib/dates/displayDate'
import { displayAmount } from '@/lib/currency/convert'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { appHref } from '@/lib/sites/href'
import type { CabinBookingStatus } from '@/services/cabin/booking/constants'
import type { PageOperationArgs } from '@/app/ServerPage'

type Tab = NonNullable<ReturnType<typeof QueryParams.cabinBookingTab.decode>>

const tabs: { tab: Tab, label: string }[] = [
    { tab: 'upcoming', label: 'Kommende' },
    { tab: 'awaiting-payment', label: 'Venter på betaling' },
    { tab: 'past', label: 'Tidligere' },
    { tab: 'canceled', label: 'Avbestilt' },
]

const kept: CabinBookingStatus[] = ['PAID', 'PROCESSING', 'BLOCKED']

// Expired reservations were never paid for, so no tab shows them.
const inTab: Record<Tab, (status: CabinBookingStatus, isPast: boolean) => boolean> = {
    upcoming: (status, isPast) => !isPast && kept.includes(status),
    'awaiting-payment': status => status === 'AWAITING_PAYMENT',
    past: (status, isPast) => isPast && kept.includes(status),
    canceled: status => status === 'CANCELED',
}

const { page, generateMetadata } = serverPage({
    operation: async ({ session, searchParams }: PageOperationArgs) => {
        await authorizeAdminPage('cabin-booking', session)
        const tab = QueryParams.cabinBookingTab.decode(searchParams) ?? 'upcoming'
        const search = QueryParams.search.decode(searchParams) ?? ''
        const now = new Date()

        // ponytail: filters every booking in memory, which is fine for a few hundred a year. Move the
        // filter into readMany with paging once the list gets slow.
        const bookings = (await cabinBookingOperations.readMany({}))
            .map(booking => ({ ...booking, status: cabinBookingStatus(booking, now) }))
            .filter(booking => inTab[tab](booking.status, booking.end < now))
            .filter(booking => {
                if (!search) return true
                const needle = search.toLowerCase()
                const email = booking.user?.email ?? booking.guestUser?.email ?? ''
                return `#${booking.id} ${bookerName(booking)} ${email}`.toLowerCase().includes(needle)
            })
        if (tab === 'past' || tab === 'canceled') bookings.reverse()

        return { bookings, tab, search }
    },
    metadata: () => ({ title: 'Hyttebookinger' }),
    render: ({ data: { bookings, tab, search } }) => (
        <PageWrapper search={{ value: search, label: 'Søk på navn, e-post eller #' }}>
            <section className={cabinAdminCardClassName}>
                <nav aria-label="Filtrer bookinger" className="flex flex-wrap gap-2">
                    {tabs.map(option => (
                        <SiteLink
                            key={option.tab}
                            href={appHref(`/admin/cabin-booking?${QueryParams.cabinBookingTab.encodeUrl(option.tab)}`)}
                            aria-current={option.tab === tab ? 'page' : undefined}
                            className={`
                                rounded-full px-4 py-2 no-underline border
                                ${option.tab === tab
                            ? 'bg-primary border-primary text-primary-content'
                            : `
                                border-base-300 text-base-content
                                hover:bg-base-300
                            `}
                            `}
                        >
                            {option.label}
                        </SiteLink>
                    ))}
                </nav>

                {bookings.length === 0
                    ? <p className="m-0 text-base-content/80">Ingen bookinger her.</p>
                    : <div className="overflow-x-auto"><SimpleTable
                        className={cabinAdminTableClassName}
                        header={['#', 'Leietaker', 'Datoer', 'Type', 'Personer', 'Pris', 'Status']}
                        body={bookings.map(booking => [
                            booking.id,
                            <span key="booker">
                                {bookerName(booking)}
                                <span className="block text-s text-base-content/70">
                                    {bookerKind(booking)}
                                </span>
                            </span>,
                            `${displayDate(booking.start, false)} – ${displayDate(booking.end, false)}`,
                            describeBooking(booking),
                            booking.type === 'CABIN'
                                ? `${booking.numberOfMembers} + ${booking.numberOfNonMembers}`
                                : '',
                            booking.totalPrice ? displayAmount(booking.totalPrice) : '',
                            <span
                                key="status"
                                className={`
                                    ${cabinAdminBadgeClassName}
                                    ${statusClassNames[booking.status]}
                                `}
                            >
                                {statusLabels[booking.status]}
                            </span>,
                        ])}
                        links={bookings.map(booking => appHref(`/admin/cabin-booking/${booking.id}`))}
                    /></div>
                }
            </section>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
