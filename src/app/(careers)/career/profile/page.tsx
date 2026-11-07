import ContactInfoForm from './ContactInfoForm'
import { careersAuthLinks } from '@/app/(careers)/career/(auth)/links'
import { companyPresentationLinks } from '@/app/(careers)/career/company-presentations/links'
import { badgeClassName, sectionHeadingClassName } from '@/app/(careers)/_lib/careersClassNames'
import { userOperations } from '@/services/users/operations'
import { ClassLevelConfig } from '@/services/groups/constants'
import { dotOperations } from '@/services/dots/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { contactorNotificationChannel } from '@/services/careers/contactorNotificationChannel'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import { Smorekopp } from '@/services/error'
import { displayDate } from '@/lib/dates/displayDate'
import { serverPage } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import UpdateNotificationSubscription from '@/components/Notifications/UpdateNotificationSubscription'
import type { ReactNode } from 'react'

function Section({ title, children }: { title: string, children: ReactNode }) {
    return (
        <section className="
            p-8 bg-base-200 border border-careers-line
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

        const channel = await contactorNotificationChannel.readChannel({})
        const [user, profile, registrations, dots, [subscription]] = await Promise.all([
            userOperations.read({ params: { id: userId } }),
            userOperations.readProfile({ params: { username: session.user.username } }),
            eventRegistrationOperations.readUpcomingOfUser({
                params: { userId, specialTag: 'COMPANY_PRESENTATION' },
            }),
            dotOperations.readForUser({ params: { userId, onlyActive: true } }),
            notificationSubscriptionOperations.read({ params: { userId, channelIds: [channel.id] } }),
        ])

        return { user, profile, registrations, dots, channel, subscription }
    },
    metadata: () => ({ title: 'Min side' }),
    render: ({ data: { user, profile, registrations, dots, channel, subscription } }) => (
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
                <p className="mt-2 text-m text-base-content/80">{user.email}</p>
            </div>

            <Section title="Mine påmeldinger">
                {registrations.length === 0 ? (
                    <p className="text-m text-base-content/80">
                        Du er ikke påmeldt noen kommende bedriftspresentasjoner.{' '}
                        <SiteLink href={companyPresentationLinks.list()}>Se bedriftspresentasjonene</SiteLink>
                    </p>
                ) : (
                    <ul className="flex flex-col list-none divide-y divide-careers-line">
                        {registrations.map(registration => (
                            <li key={registration.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
                                <SiteLink
                                    href={companyPresentationLinks.event(registration.event)}
                                    className="text-m font-semibold text-careers-navy"
                                >
                                    {registration.event.name}
                                </SiteLink>
                                <span className="text-s text-base-content/80">
                                    {displayDate(registration.event.eventStart)}
                                    {registration.event.location && ` · ${registration.event.location}`}
                                </span>
                                {registration.onWaitingList && (
                                    <span className="text-s font-semibold text-warning">Venteliste</span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <Section title="Studie">
                <dl className="
                    grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-m
                    [&>dt]:text-base-content/80
                ">
                    <dt>Klasse</dt>
                    <dd>{profile.class ? ClassLevelConfig[profile.class.level].name : 'Ingen klasse registrert'}</dd>
                    <dt>Studieprogram</dt>
                    <dd>
                        {profile.groups.activeStudyProgrammes.length === 0
                            ? 'Ingen studieprogram registrert'
                            : profile.groups.activeStudyProgrammes.map(({ studyProgramme }) => (
                                <span key={studyProgramme.id} className="block">
                                    {studyProgramme.name} ({studyProgramme.code})
                                </span>
                            ))}
                    </dd>
                </dl>
            </Section>

            <Section title="Kontaktinfo og mat">
                <ContactInfoForm username={user.username} mobile={user.mobile} allergies={user.allergies} />
            </Section>

            <Section title="E-post fra Contactor">
                <UpdateNotificationSubscription
                    userId={user.id}
                    channel={channel}
                    methods={subscription?.methods ?? allNotificationMethodsOff}
                    inherited={!subscription?.explicit}
                    hasChildren={false}
                />
            </Section>

            <Section title="Prikker">
                {dots.length === 0 ? (
                    <p className="text-m text-base-content/80">Du har ingen aktive prikker.</p>
                ) : (
                    <ul className="flex flex-col list-none divide-y divide-careers-line">
                        {dots.map(dot => (
                            <li key={dot.id} className="flex flex-col gap-1 py-3">
                                <span className="text-m font-semibold">{dot.reason}</span>
                                <span className="text-s text-base-content/80">
                                    {dot.valueLeft} av {dot.value} igjen · siste utløper{' '}
                                    {displayDate(dot.expiryForEachDotValue[dot.expiryForEachDotValue.length - 1], false)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            <SiteLink href={careersAuthLinks.logout()} className="self-start text-m text-base-content/80">Logg ut</SiteLink>
        </div>
    ),
})

export default page
export { generateMetadata }
