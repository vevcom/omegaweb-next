import UpcomingRegistrationRow from './UpcomingRegistrationRow'
import CabinBookingRow from './CabinBookingRow'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { cabinBookingOperations } from '@/services/cabin/booking/operations'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { serverPage, withFallback } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'registrations', session)
        const userId = profile.user.id
        // Each list has its own rule, so one the viewer may not read is left out.
        const [registrations, cabinBookings] = await Promise.all([
            withFallback(eventRegistrationOperations.readUpcomingOfUser({ params: { userId } }), null, ['UNAUTHORIZED']),
            withFallback(cabinBookingOperations.readManyOfUser({ params: { userId } }), null, ['UNAUTHORIZED']),
        ])
        return { registrations, cabinBookings, now: new Date() }
    },
    render: ({ data: { registrations, cabinBookings, now } }) => (
        <div className="min-h-full bg-base-100 rounded-round p-(--card-padding)">
            {registrations && <>
                <h2>Påmeldinger</h2>
                {registrations.length === 0 ? (
                    <p>
                        Ingen påmeldinger til kommende arrangementer.{' '}
                        <SiteLink href={omegaEventLinks.list()}>Se hvad der hender</SiteLink>
                    </p>
                ) : (
                    <div className="row-list">
                        {registrations.map(registration => (
                            <UpcomingRegistrationRow
                                key={registration.id}
                                registration={registration}
                                config={omegaEventPages}
                            />
                        ))}
                    </div>
                )}
            </>}
            {cabinBookings && <>
                <h2 className={registrations ? 'mt-8' : undefined}>Hyttebookinger</h2>
                {cabinBookings.length === 0 ? (
                    <p>
                        Ingen hyttebookinger.{' '}
                        <SiteLink href={appHref('/cabin/book')}>Book Heutten</SiteLink>
                    </p>
                ) : (
                    <div className="row-list">
                        {cabinBookings.map(booking => (
                            <CabinBookingRow key={booking.id} booking={booking} now={now} />
                        ))}
                    </div>
                )}
            </>}
        </div>
    ),
})

export default page
export { generateMetadata }
