import ContactInfoForm from './ContactInfoForm'
import ContactorNotifications from './ContactorNotifications'
import { careersAuthLinks } from '@/app/(careers)/career/(auth)/links'
import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'
import { badgeClassName, sectionHeadingClassName } from '@/app/(careers)/_lib/careersClassNames'
import { userOperations } from '@/services/users/operations'
import { dotOperations } from '@/services/dots/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { Smorekopp } from '@/services/error'
import { displayDate } from '@/lib/dates/displayDate'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
import type { NotificationMethodGeneral } from '@/services/notifications/types'
import type { ReactNode } from 'react'

const pickMethods = ({ email, emailWeekly, push }: NotificationMethodGeneral): NotificationMethodGeneral => (
    { email, emailWeekly, push }
)

function Section({ title, children }: { title: string, children: ReactNode }) {
    return (
        <section className="
            p-8 bg-surface-raised border border-careers-line
            max-mobile:p-6
        ">
            <h2 className="mb-6 text-l text-careers-navy">{title}</h2>
            {children}
        </section>
    )
}

/** The career site's page for the logged in user: their details, their registrations and their dots. */
const { page, generateMetadata } = serverPage({
    operation: async ({ session }) => {
        if (!session.user) throw new Smorekopp('UNAUTHENTICATED')
        const userId = session.user.id

        const [user, registrations, dots, channel, subscriptions] = await Promise.all([
            userOperations.read({ params: { id: userId } }),
            eventRegistrationOperations.readUpcomingOfUser({
                params: { userId, specialTag: 'COMPANY_PRESENTATION' },
            }),
            dotOperations.readForUser({ params: { userId, onlyActive: true } }),
            notificationChannelOperations.readSpecial({ params: { special: 'CONTACTOR' } }),
            notificationSubscriptionOperations.read({ params: { userId } }),
        ])
        const subscription = subscriptions.find(candidate => candidate.channelId === channel.id)

        return { user, registrations, dots, channel, subscription }
    },
    metadata: () => ({ title: 'Min side' }),
    render: ({ data: { user, registrations, dots, channel, subscription } }) => (
        <div className="flex flex-col gap-8 max-w-3xl py-16">
            <div>
                <span className={`
                    ${badgeClassName}
                    text-careers-accent-dark
                `}>Min side</span>
                <h1 className={`
                    ${sectionHeadingClassName}
                    text-careers-navy
                `}>{user.firstname} {user.lastname}</h1>
                <p className="mt-2 text-m text-text-muted">{user.email}</p>
            </div>

            <Section title="Mine påmeldinger">
                {registrations.length === 0 ? (
                    <p className="text-m text-text-muted">
                        Du er ikke påmeldt noen kommende bedriftspresentasjoner.{' '}
                        <Link href={companyPresentationLinks.list()}>Se bedriftspresentasjonene</Link>
                    </p>
                ) : (
                    <ul className="flex flex-col list-none divide-y divide-careers-line">
                        {registrations.map(registration => (
                            <li key={registration.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
                                <Link
                                    href={companyPresentationLinks.event(registration.event)}
                                    className="text-m font-semibold text-careers-navy"
                                >
                                    {registration.event.name}
                                </Link>
                                <span className="text-s text-text-muted">
                                    {displayDate(registration.event.eventStart)}
                                    {registration.event.location && ` · ${registration.event.location}`}
                                </span>
                                {registration.onWaitingList && (
                                    <span className="text-s font-semibold text-accent-orange">Venteliste</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Kontaktinfo og mat">
                <ContactInfoForm username={user.username} mobile={user.mobile} allergies={user.allergies} />
            </Section>

            <Section title="E-post fra Contactor">
                <p className="mb-4 text-m text-text-muted">{channel.description}</p>
                <ContactorNotifications
                    userId={user.id}
                    channelId={channel.id}
                    availableMethods={pickMethods(channel.availableMethods)}
                    methods={pickMethods(subscription?.methods ?? allNotificationMethodsOff)}
                />
            </Section>

            <Section title="Prikker">
                {dots.length === 0 ? (
                    <p className="text-m text-text-muted">Du har ingen aktive prikker.</p>
                ) : (
                    <ul className="flex flex-col list-none divide-y divide-careers-line">
                        {dots.map(dot => (
                            <li key={dot.id} className="flex flex-col gap-1 py-3">
                                <span className="text-m font-semibold">{dot.reason}</span>
                                <span className="text-s text-text-muted">
                                    {dot.valueLeft} av {dot.value} igjen · siste utløper{' '}
                                    {displayDate(dot.expiryForEachDotValue[dot.expiryForEachDotValue.length - 1], false)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Link href={careersAuthLinks.logout()} className="self-start text-m text-text-muted">Logg ut</Link>
        </div>
    ),
})

export default page
export { generateMetadata }
