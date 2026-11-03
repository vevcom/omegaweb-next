import UpcomingRegistrationRow from './UpcomingRegistrationRow'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { omegaEventLinks } from '@/app/(omegaweb)/events/links'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'registrations', session)
        const registrations = await eventRegistrationOperations.readUpcomingOfUser({
            params: { userId: profile.user.id },
        })
        return { profile, registrations }
    },
    render: ({ data }) => (
        <div className="min-h-full bg-surface-base rounded-round p-(--card-padding)">
            <h2>Påmeldinger</h2>
            {data.registrations.length === 0 ? (
                <p>
                    Ingen påmeldinger til kommende arrangementer.{' '}
                    <Link href={omegaEventLinks.list()}>Se hvad der hender</Link>
                </p>
            ) : (
                <div className="row-list">
                    {data.registrations.map(registration => (
                        <UpcomingRegistrationRow
                            key={registration.id}
                            registration={registration}
                            config={omegaEventPages}
                        />
                    ))}
                </div>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
