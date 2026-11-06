import styles from './EventPage.module.scss'
import { eventLinks } from '@/pageKits/events/links'
import { omegaLinks } from '@/app/(omegaweb)/links'
import ShowAndEditName from '@/components/Event/ShowAndEditName'
import RegistrationUI from '@/components/Event/RegistrationUI'
import RegistrationsList from '@/components/Event/RegistrationsList'
import EventAdmin from '@/components/Event/EventAdmin'
import EventQuotaList from '@/components/Event/EventQuotaList'
import EventPaymentSection from '@/components/Event/EventPaymentSection'
import EventSection from '@/components/Event/EventSection'
import EventInfoRow from '@/components/Event/EventInfoRow'
import EventNotificationsAdmin from '@/components/Event/EventNotificationsAdmin'
import NotificationSubscriptionTree from '@/components/Notifications/NotificationSubscriptionTree'
import EventLocationMap from '@/components/Event/EventLocationMap'
import EventTag from '@/components/Event/EventTag'
import DateDisplay from '@/components/Date/Date'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import DraftBanner from '@/components/UI/DraftBanner'
import { AdminHeaderItemPopUp, NotificationHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import HeaderItemLink from '@/components/HeaderItems/HeaderItemLink'
import { eventTagOperations } from '@/services/events/tags/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import {
    updateEventCmsCoverImageAction,
    updateEventParagraphContentAction
} from '@/services/events/actions'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { stripeCustomerOperations } from '@/services/stripeCustomers/operations'
import { configureAction } from '@/services/configureAction'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { eventAuth } from '@/services/events/auth'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { eventNotificationAuth } from '@/services/events/notifications/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { Require } from '@/auth/authorizer/Require'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import { serverPage, withFallback } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import { notFound } from 'next/navigation'
import { faCalendar, faLocationDot, faLock, faPeopleGroup, faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { EventAccess } from '@/services/events/types'
import type { PageOperationArgs } from '@/app/ServerPage'

const iconRowClassName = `
    m-0 flex items-center gap-3 text-m
    [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-text-muted
`

/** The page of one event, rendered under the config's path on Omega's site and on the career site. */
export function eventPage(config: EventPagesConfig) {
    const links = eventLinks(config)
    return serverPage({
        operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
            const event = await eventOperations.read({
                params: {
                    id: decodeVevenUriHandleError(params.nameAndId)
                }
            })

            if (config.lockedTag && !event.tags.some(tag => tag.special === config.lockedTag)) notFound()

            const tags = await eventTagOperations.readAll({})

            // Without COMMITTEE_USE the edit form simply gets no committee picker.
            const committees = await withFallback(committeeOperations.readAll({}), null)

            // Readable by those who may see the event; the fallback denies everyone but EVENT_ADMIN.
            const adminVisibility = await withFallback(
                eventOperations.adminVisibility.readMatrix({ params: { id: event.id } }),
                null
            )
            const access: EventAccess = {
                published: event.published,
                canBeViewedBy: event.canBeViewedBy,
                adminVisibility: adminVisibility ?? EMPTY_VISIBILITY.adminLevel,
                creatorId: event.createdById,
                quotaVisibilities: event.variants.flatMap(variant => variant.quotas.map(quota => quota.visibility)),
            }

            const administers = eventAuth.update.data(access).auth(session).authorized
            const ledgerAccounts = administers
                ? await withFallback(ledgerAccountOperations.readAccessible({
                    params: { includeGroupAccounts: true, includeUserAccounts: false },
                }), [])
                : []

            const dotPunishment = event.variants.length > 0 && session.user
                ? await eventRegistrationOperations.readDotPunishmentOfUser({
                    params: { userId: session.user.id },
                })
                : null

            // Per variant: the viewer's registration, the quotas they pass, and whether one has a place.
            const userId = session.user?.id
            const registrations = event.variants.length > 0 && userId !== undefined
                ? await Promise.all(event.variants.map(variant => eventRegistrationOperations.readOfUser({
                    params: { eventId: event.id, userId, variantId: variant.id },
                })))
                : event.variants.map(() => null)
            const variantViews = event.variants.map((variant, index) => {
                const eligibleQuotas = variant.quotas.filter(quota => checkVisibility(session.memberships, quota.visibility))
                return {
                    variant,
                    registration: registrations[index],
                    eligibleQuotaIds: session.user ? eligibleQuotas.map(quota => quota.id) : null,
                    eligibility: {
                        passesAnyQuota: eligibleQuotas.length > 0,
                        placeAvailable: eligibleQuotas.some(quota => quota.numOfRegistrations < quota.places),
                    },
                }
            })

            let eventPaymentBalance: number | undefined
            let eventPaymentCustomerSessionSecret: string | undefined

            if (event.takesPayment && session.user) {
                eventPaymentBalance = (await ledgerAccountOperations.calculateBalance({
                    params: { userId: session.user.id },
                })).amount

                const customerSession = await withFallback(
                    stripeCustomerOperations.createSession({ params: { userId: session.user.id } }),
                    null
                )
                eventPaymentCustomerSessionSecret = customerSession?.customerSessionClientSecret
            }

            const channelsOfEvent = [
                event.notificationChannel,
                event.infoNotificationChannel,
                event.generalNotificationChannel,
            ]
            const subscriptions = session.user
                ? await notificationSubscriptionOperations.read({
                    params: { userId: session.user.id, channelIds: channelsOfEvent.map(channel => channel.id) },
                })
                : []

            // For giving dots after the event; readable by those administrating it.
            const eventHasEnded = event.eventEnd < new Date()
            const notAttended = event.takesRegistration && eventHasEnded
                ? await withFallback(eventRegistrationOperations.readNotAttended({ params: { eventId: event.id } }), null)
                : null
            const statistics = event.takesRegistration
                ? await withFallback(eventOperations.readStatistics({ params: { id: event.id } }), null)
                : null
            const seatingGuests = event.takesRegistration
                ? await withFallback(eventOperations.readSeatingGuests({ params: { id: event.id } }), null)
                : null

            return {
                event,
                tags,
                committees,
                access,
                adminVisibilityKnown: adminVisibility !== null,
                ledgerAccounts,
                dotPunishment,
                variantViews,
                eventPaymentBalance,
                eventPaymentCustomerSessionSecret,
                notAttended,
                channelsOfEvent,
                subscriptions,
                statistics,
                seatingGuests,
            }
        },
        capabilities: (data, session) => ({
            canEditCmsCoverImage: eventAuth.updateCmsCoverImage.data(data.access),
            canEditCmsParagraph: eventAuth.updateParagraphContent.data(data.access),
            canDestroy: eventAuth.destroy.data(data.access),
            canUpdate: eventAuth.update.data(data.access),
            canConnectToLedgerAccount: eventAuth.connectToLedgerAccount.data({
                ...data.access,
                accounts: data.ledgerAccounts.map(account => account.ownership),
            }),
            canCreateNotification: eventNotificationAuth.createNotification.data(data.access),
            canReadRegistrations: eventRegistrationAuth.readPage.data(data.access),
            canReadRegistrationsDetailed: eventRegistrationAuth.readPageDetailed.data(data.access),
            canRegisterAsAdmin: eventRegistrationAuth.createAsAdmin.data(data.access),
            canUnregisterAsAdmin: eventRegistrationAuth.destroyAsAdmin.data(data.access),
            canRegisterGuest: eventRegistrationAuth.createGuest.data(data.access),
            canTakeAttendance: session.user ? eventRegistrationAuth.registerAttendance.data({
                ...data.access,
                userId: session.user.id,
            }) : Require.user(),
            canGiveDots: session.user ? eventRegistrationAuth.createDot.data({
                ...data.access,
                userId: session.user.id,
            }) : Require.user(),
            canRegister: session.user ? eventRegistrationAuth.create.data({
                ...data.access,
                userId: session.user.id,
            }) : Require.user(),
            canPay: session.user
                ? eventRegistrationAuth.createPayment.data({ userId: session.user.id })
                : Require.user(),
        }),
        metadata: (data) => ({ title: data.event.name }),
        render: ({ data, capabilities, session }) => {
            const { event, tags, committees, access, ledgerAccounts, dotPunishment } = data
            const attendanceTakerId = capabilities.canTakeAttendance.authorized && session.user ? session.user.id : null
            const dotGiverId = capabilities.canGiveDots.authorized && session.user ? session.user.id : null
            const severalVariants = event.variants.length > 1

            return (
                <div className="w-full flex flex-wrap items-stretch gap-2">
                    {!event.published && <div className="flex-[0_0_100%]">
                        <DraftBanner>
                            Arrangementet er ikke publisert. Bare de som administrerer det ser det. Publiser det under
                            Administrer.
                        </DraftBanner>
                    </div>}
                    <span className={`
                        ${styles.coverImage}
                        flex-[0_0_100%] block relative h-[20em]
                        max-mobile:h-auto max-mobile:aspect-video
                        bg-surface-base rounded-round overflow-hidden
                    `}>
                        <CmsImage
                            capabilities={{ canEdit: capabilities.canEditCmsCoverImage }}
                            cmsImage={event.coverImage}
                            width={900}
                            sizes="100vw"
                            updateCmsImageAction={
                                configureAction(
                                    updateEventCmsCoverImageAction,
                                    { implementationParams: { eventId: event.id } }
                                )}
                        />
                        <div className={`
                            ${styles.overlay}
                            absolute inset-[auto_0_0_0] flex flex-wrap items-baseline gap-x-[1em] gap-y-0 pt-8 px-6 pb-4
                            bg-[linear-gradient(to_bottom,transparent,rgb(0_0_0/60%))] rounded-b-round
                            [&_h1]:text-xxl [&_h1]:wrap-anywhere [&_h1]:text-white
                        `}>
                            <ShowAndEditName
                                event={event}
                                config={config}
                                capabilities={{ canUpdate: capabilities.canUpdate.toJsObject() }}
                            />
                            <ul className="
                                list-none flex flex-wrap gap-x-[1em] gap-y-0
                                [&_a]:no-underline
                            ">
                                {/* Under a locked tag the list takes no other tag filter, so the tags are not links. */}
                                {event.tags.map(tag => (
                                    <li key={tag.id}>
                                        {config.lockedTag ? (
                                            <EventTag eventTag={tag} />
                                        ) : (
                                            <SiteLink href={links.list([tag.name])}>
                                                <EventTag eventTag={tag} />
                                            </SiteLink>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className={`
                            ${styles.overlay}
                            absolute top-2 right-2 z-1 flex flex-wrap justify-end gap-2
                        `}>
                            {(capabilities.canUpdate.authorized || capabilities.canDestroy.authorized
                                || capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized
                            ) && (
                                <AdminHeaderItemPopUp popUpKey="EventAdmin">
                                    <EventAdmin
                                        event={event}
                                        access={access}
                                        adminVisibilityKnown={data.adminVisibilityKnown}
                                        config={config}
                                        eventTags={tags}
                                        committees={committees}
                                        ledgerAccounts={
                                            capabilities.canConnectToLedgerAccount.authorized ? ledgerAccounts : []
                                        }
                                        statistics={data.statistics}
                                        seatingGuests={data.seatingGuests}
                                        capabilities={capabilitiesToJsObject({
                                            canUpdate: capabilities.canUpdate,
                                            canDestroy: capabilities.canDestroy,
                                            canRegisterAsAdmin: capabilities.canRegisterAsAdmin,
                                            canRegisterGuest: capabilities.canRegisterGuest,
                                        })}
                                    />
                                </AdminHeaderItemPopUp>
                            )}
                            {capabilities.canCreateNotification.authorized && (
                                <NotificationHeaderItemPopUp scale={30} popUpKey="EventNotifications" ariaLabel="Varsle">
                                    <EventNotificationsAdmin event={event} eventHref={links.event(event)} />
                                </NotificationHeaderItemPopUp>
                            )}
                            {event.takesRegistration && capabilities.canTakeAttendance.authorized && (
                                <HeaderItemLink
                                    href={links.attendance(event)}
                                    label="Registrer oppmøte"
                                    icon={faQrcode}
                                    iconOnlyScale={40}
                                />
                            )}
                        </div>
                    </span>
                    <div className="
                        grid gap-2 w-full grid-cols-[minmax(0,1fr)]
                        mobile:grid-cols-[minmax(0,1fr)_22rem] mobile:grid-rows-[auto_1fr]
                    ">
                        <EventSection title="Tid og sted">
                            <p className={iconRowClassName}>
                                <FontAwesomeIcon icon={faCalendar} />
                                <span>
                                    <DateDisplay date={event.eventStart} includeSeconds={false} />
                                    {' – '}
                                    <DateDisplay date={event.eventEnd} includeSeconds={false} />
                                </span>
                            </p>
                            <p className={iconRowClassName}>
                                <FontAwesomeIcon icon={faLocationDot} />
                                <span>{event.location}</span>
                            </p>
                            {event.hostedByCommittee && <p className={iconRowClassName}>
                                <FontAwesomeIcon icon={faPeopleGroup} />
                                <span>
                                    Arrangeres av <SiteLink href={omegaLinks.committee(event.hostedByCommittee)}>
                                        {event.hostedByCommittee.name}
                                    </SiteLink>
                                </span>
                            </p>}
                        </EventSection>
                        <aside className="
                            flex flex-col gap-2 min-w-0
                            mobile:col-start-2 mobile:row-start-1 mobile:row-span-2
                        ">
                            {event.variants.length > 0 ? data.variantViews.map(view => (
                                <EventSection
                                    key={view.variant.id}
                                    title={severalVariants ? view.variant.name : 'Påmelding'}
                                >
                                    {!view.variant.takesRegistration && (
                                        <p className="m-0 text-text-muted">Varianten har ingen plasser ennå.</p>
                                    )}
                                    <EventQuotaList quotas={view.variant.quotas} eligibleQuotaIds={view.eligibleQuotaIds} />
                                    {event.waitingList && (
                                        <EventInfoRow label="På venteliste">{view.variant.numOnWaitingList}</EventInfoRow>
                                    )}
                                    <EventInfoRow label="Påmeldingsstart">
                                        <DateDisplay date={view.variant.registrationStart} includeSeconds={false} />
                                    </EventInfoRow>
                                    <EventInfoRow label="Påmeldingsslutt">
                                        <DateDisplay date={view.variant.registrationEnd} includeSeconds={false} />
                                    </EventInfoRow>
                                    {event.bindingRegistration && <p className={iconRowClassName}>
                                        <FontAwesomeIcon icon={faLock} />
                                        <span>Påmeldingen er bindende</span>
                                    </p>}
                                    {view.variant.takesRegistration && <RegistrationUI
                                        config={config}
                                        event={event}
                                        variant={view.variant}
                                        registration={view.registration}
                                        dotPunishment={dotPunishment}
                                        eligibility={view.eligibility}
                                        capabilities={{
                                            canRegister: capabilities.canRegister.toJsObject(),
                                            canRegisterAsAdmin: capabilities.canRegisterAsAdmin.toJsObject(),
                                            canUnregisterAsAdmin: capabilities.canUnregisterAsAdmin.toJsObject(),
                                        }}
                                    />}
                                    {view.variant.takesPayment && (
                                        <EventPaymentSection
                                            eventId={event.id}
                                            variant={view.variant}
                                            registration={view.registration}
                                            userId={session.user?.id ?? null}
                                            availableBalance={data.eventPaymentBalance}
                                            customerSessionClientSecret={data.eventPaymentCustomerSessionSecret}
                                            capabilities={{ canPay: capabilities.canPay }}
                                        />
                                    )}
                                </EventSection>
                            )) : (
                                <EventSection title="Påmelding">
                                    <p className="text-text-muted">Dette arrangementet tar ikke påmelding.</p>
                                </EventSection>
                            )}

                            {session.user && (
                                <EventSection title="Varslinger">
                                    <NotificationSubscriptionTree
                                        userId={session.user.id}
                                        channels={data.channelsOfEvent}
                                        subscriptions={data.subscriptions}
                                    />
                                </EventSection>
                            )}
                        </aside>
                        <main className="min-w-0 p-4 bg-surface-base rounded-round">
                            <CmsParagraph
                                capabilities={{ canEdit: capabilities.canEditCmsParagraph }}
                                cmsParagraph={event.paragraph}
                                updateCmsParagraphAction={
                                    configureAction(
                                        updateEventParagraphContentAction,
                                        { implementationParams: { eventId: event.id } }
                                    )
                                }
                            />
                            {event.locationMap && <section aria-label="Kart til arrangementet">
                                <h2>Her finner du oss</h2>
                                <EventLocationMap locationMap={event.locationMap} />
                            </section>}
                        </main>
                    </div>

                    {event.takesRegistration && capabilities.canReadRegistrations.authorized && (
                        <div className="
                            flex-[0_0_100%] bg-surface-base p-2 rounded-round
                            [&>h4]:text-xl [&>h4]:font-bold
                        ">
                            <RegistrationsList
                                event={event}
                                canReadDetailed={capabilities.canReadRegistrationsDetailed.authorized}
                                attendanceTakerId={attendanceTakerId}
                                dotGiverId={dotGiverId}
                                notAttended={data.notAttended}
                            />
                        </div>
                    )}
                </div>
            )
        },
    })
}
