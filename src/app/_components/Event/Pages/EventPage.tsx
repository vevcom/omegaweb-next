import styles from './EventPage.module.scss'
import { eventHref, eventListHref } from './eventPages'
import ShowAndEditName from '@/components/Event/ShowAndEditName'
import RegistrationUI from '@/components/Event/RegistrationUI'
import RegistrationsList from '@/components/Event/RegistrationsList'
import ManualRegistrationForm from '@/components/Event/ManualRegistrationForm'
import EventVisibilityAdmin from '@/components/Event/EventVisibilityAdmin'
import EventQuotasAdmin from '@/components/Event/EventQuotasAdmin'
import EventQuotaList from '@/components/Event/EventQuotaList'
import ConnectEventToLedgerForm from '@/components/Event/ConnectEventToLedgerForm'
import EventPaymentSection from '@/components/Event/EventPaymentSection'
import EventSidebarSection from '@/components/Event/EventSidebarSection'
import EventInfoRow from '@/components/Event/EventInfoRow'
import EventLocationMap from '@/components/Event/EventLocationMap'
import CreateOrUpdateEventForm from '@/components/Event/CreateOrUpdateEventForm'
import EventTag from '@/components/Event/EventTag'
import DateDisplay from '@/components/Date/Date'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import Form from '@/components/Form/Form'
import {
    DeleteHeaderItemPopUp,
    EditHeaderItemPopUp,
    PaymentHeaderItemPopUp,
    QuotasHeaderItemPopUp,
    UsersHeaderItemPopUp,
    VisibilityHeaderItemPopUp,
} from '@/components/HeaderItems/HeaderItemPopUp'
import HeaderItemLink from '@/components/HeaderItems/HeaderItemLink'
import { eventTagOperations } from '@/services/events/tags/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import {
    destroyEventAction,
    updateEventCmsCoverImageAction,
    updateEventParagraphContentAction
} from '@/services/events/actions'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { stripeCustomerOperations } from '@/services/stripeCustomers/operations'
import { configureAction } from '@/services/configureAction'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { eventAuth } from '@/services/events/auth'
import { eventQuotaAuth } from '@/services/events/quotas/auth'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { Require } from '@/auth/authorizer/Require'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { faCalendar, faLocationDot, faLock, faPeopleGroup, faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { EventPagesConfig } from './eventPages'
import type { RegistrationEligibility } from '@/components/Event/RegistrationUI'
import type { EventAccess } from '@/services/events/types'
import type { PageOperationArgs } from '@/app/ServerPage'

const iconRowClassName = `
    m-0 flex items-center gap-3 text-m
    [&>svg]:size-5 [&>svg]:shrink-0 [&>svg]:text-text-muted
`

/** The page of one event, rendered under `config.basePath` on Omega's site and on the career site. */
export const eventPage = (config: EventPagesConfig) => serverPage({
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
            quotaVisibilities: event.quotas.map(quota => quota.visibility),
        }

        const administers = eventAuth.update.data(access).auth(session).authorized
        const ledgerAccounts = administers
            ? await withFallback(ledgerAccountOperations.readAccessible({
                params: { includeGroupAccounts: true, includeUserAccounts: false },
            }), [])
            : []

        const dotPunishment = event.takesRegistration && session.user
            ? await eventRegistrationOperations.readDotPunishmentOfUser({
                params: { userId: session.user.id },
            })
            : null

        const ownRegistration = event.takesRegistration && session.user
            ? await eventRegistrationOperations.readOfUser({
                params: { eventId: event.id, userId: session.user.id },
            })
            : null

        // The quotas the viewer passes, and what they add up to for the registration button.
        const eligibleQuotas = event.quotas.filter(quota => checkVisibility(session.memberships, quota.visibility))
        const now = Date.now()
        const eligibility: RegistrationEligibility = {
            passesAnyQuota: eligibleQuotas.length > 0,
            opensAt: eligibleQuotas.length
                ? new Date(Math.min(...eligibleQuotas.map(quota => quota.registrationStart.getTime())))
                : null,
            closesAt: eligibleQuotas.length
                ? new Date(Math.max(...eligibleQuotas.map(quota => quota.registrationEnd.getTime())))
                : null,
            placeAvailable: eligibleQuotas.some(quota => (
                quota.registrationStart.getTime() <= now
                && now <= quota.registrationEnd.getTime()
                && quota.numOfRegistrations < quota.places
            )),
        }

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

        // For giving dots after the event; readable by those administrating it.
        const eventHasEnded = event.eventEnd < new Date()
        const notAttended = event.takesRegistration && eventHasEnded
            ? await withFallback(eventRegistrationOperations.readNotAttended({ params: { eventId: event.id } }), null)
            : null

        return {
            event,
            tags,
            committees,
            access,
            adminVisibilityKnown: adminVisibility !== null,
            ledgerAccounts,
            dotPunishment,
            ownRegistration,
            eligibleQuotaIds: session.user ? eligibleQuotas.map(quota => quota.id) : null,
            eligibility,
            eventPaymentBalance,
            eventPaymentCustomerSessionSecret,
            notAttended,
        }
    },
    capabilities: (data, session) => ({
        canEditCmsCoverImage: eventAuth.updateCmsCoverImage.data(data.access),
        canEditCmsParagraph: eventAuth.updateParagraphContent.data(data.access),
        canDestroy: eventAuth.destroy.data(data.access),
        canUpdate: eventAuth.update.data(data.access),
        canUpdateVisibility: Require.anyOf(
            eventAuth.updateAdminVisibility.data(data.access),
            eventAuth.setPublished.data(data.access),
        ),
        canUpdateQuotas: eventQuotaAuth.create.data(data.access),
        canConnectToLedgerAccount: eventAuth.connectToLedgerAccount.data({
            ...data.access,
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
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
        const { event, tags, committees, access, ledgerAccounts, dotPunishment, ownRegistration } = data
        const attendanceTakerId = capabilities.canTakeAttendance.authorized && session.user ? session.user.id : null
        const dotGiverId = capabilities.canGiveDots.authorized && session.user ? session.user.id : null

        return (
            <div className="w-full flex flex-wrap items-stretch gap-2">
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
                            basePath={config.basePath}
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
                                        <Link href={eventListHref(config.basePath, [tag.name])}>
                                            <EventTag eventTag={tag} />
                                        </Link>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={`
                        ${styles.overlay}
                        absolute top-2 right-2 z-1 flex flex-wrap justify-end gap-2
                    `}>
                        {capabilities.canUpdate.authorized && (
                            <EditHeaderItemPopUp scale={30} popUpKey="EditEvent" ariaLabel="Endre arrangementet">
                                <CreateOrUpdateEventForm
                                    event={event}
                                    basePath={config.basePath}
                                    lockedTag={config.lockedTag}
                                    eventTags={tags}
                                    committees={committees}
                                />
                            </EditHeaderItemPopUp>
                        )}
                        {capabilities.canUpdateVisibility.authorized && (
                            <VisibilityHeaderItemPopUp
                                scale={30}
                                popUpKey="EventVisibility"
                                ariaLabel="Synlighet og publisering"
                            >
                                <EventVisibilityAdmin
                                    event={event}
                                    access={access}
                                    adminVisibilityKnown={data.adminVisibilityKnown}
                                />
                            </VisibilityHeaderItemPopUp>
                        )}
                        {capabilities.canUpdateQuotas.authorized && (
                            <QuotasHeaderItemPopUp scale={30} popUpKey="EventQuotas" ariaLabel="Kvoter">
                                <EventQuotasAdmin event={event} quotas={event.quotas} />
                            </QuotasHeaderItemPopUp>
                        )}
                        {event.takesRegistration && (
                            capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized
                        ) && (
                            <UsersHeaderItemPopUp scale={30} popUpKey="Users" ariaLabel="Meld på andre">
                                <ManualRegistrationForm
                                    eventId={event.id}
                                    quotas={event.quotas}
                                    capabilities={{
                                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin.toJsObject(),
                                        canRegisterGuest: capabilities.canRegisterGuest.toJsObject(),
                                    }}
                                />
                            </UsersHeaderItemPopUp>
                        )}
                        {event.takesRegistration && capabilities.canTakeAttendance.authorized && (
                            <HeaderItemLink
                                href={`${eventHref(config.basePath, event)}/attendance`}
                                label="Registrer oppmøte"
                                icon={faQrcode}
                                iconOnlyScale={30}
                            />
                        )}
                        {event.takesPayment && capabilities.canConnectToLedgerAccount.authorized && (
                            <PaymentHeaderItemPopUp
                                scale={30}
                                popUpKey="EventLedgerAccount"
                                ariaLabel="Konto for betaling"
                            >
                                <ConnectEventToLedgerForm
                                    eventId={event.id}
                                    ledgerAccount={event.ledgerAccount}
                                    ledgerAccounts={ledgerAccounts}
                                />
                            </PaymentHeaderItemPopUp>
                        )}
                        {capabilities.canDestroy.authorized && (
                            <DeleteHeaderItemPopUp scale={30} popUpKey="DestroyEvent" ariaLabel="Slett arrangementet">
                                <div className="
                                    flex flex-col gap-4 min-w-[min(80vw,28rem)]
                                    [&>h2]:m-0
                                    [&>p]:m-0
                                ">
                                    <h2>Slett arrangementet</h2>
                                    <p>
                                        Arrangementet slettes med alle påmeldingene sine. Har noen betalt, må de
                                        meldes av først, så de får pengene tilbake.
                                    </p>
                                    <Form
                                        action={configureAction(destroyEventAction, { params: { id: event.id } })}
                                        navigateOnSuccess={config.basePath}
                                        submitText="Slett arrangementet"
                                        submitColor="red"
                                        confirmation={{
                                            confirm: true,
                                            text: 'Er du sikker på at du vil slette dette arrangementet?'
                                        }}
                                    />
                                </div>
                            </DeleteHeaderItemPopUp>
                        )}
                    </div>
                </span>
                <aside className="
                    flex-[1_1_650px] min-w-0 flex flex-col gap-2
                    max-mobile:basis-full
                ">
                    <EventSidebarSection title="Tid og sted">
                        <p className={iconRowClassName}>
                            <FontAwesomeIcon icon={faCalendar} />
                            <span>
                                <DateDisplay date={event.eventStart} includeTime />
                                {' – '}
                                <DateDisplay date={event.eventEnd} includeTime />
                            </span>
                        </p>
                        <p className={iconRowClassName}>
                            <FontAwesomeIcon icon={faLocationDot} />
                            <span>{event.location}</span>
                        </p>
                        {event.hostedByCommittee && <p className={iconRowClassName}>
                            <FontAwesomeIcon icon={faPeopleGroup} />
                            <span>
                                Arrangeres av <Link href={`/committees/${event.hostedByCommittee.shortName}`}>
                                    {event.hostedByCommittee.name}
                                </Link>
                            </span>
                        </p>}
                    </EventSidebarSection>

                    <EventSidebarSection title="Påmelding">
                        {event.takesRegistration ? <>
                            <EventQuotaList
                                quotas={event.quotas}
                                eligibleQuotaIds={data.eligibleQuotaIds}
                                takesPayment={event.takesPayment}
                            />
                            {event.waitingList && (
                                <EventInfoRow label="På venteliste">{event.numOnWaitingList}</EventInfoRow>
                            )}
                            {event.bindingRegistration && <p className={iconRowClassName}>
                                <FontAwesomeIcon icon={faLock} />
                                <span>Påmeldingen er bindende</span>
                            </p>}
                            <RegistrationUI
                                event={event}
                                registration={ownRegistration}
                                dotPunishment={dotPunishment}
                                eligibility={data.eligibility}
                                capabilities={{
                                    canRegister: capabilities.canRegister.toJsObject(),
                                    canRegisterAsAdmin: capabilities.canRegisterAsAdmin.toJsObject(),
                                    canUnregisterAsAdmin: capabilities.canUnregisterAsAdmin.toJsObject(),
                                }}
                            />
                        </> : <p className="text-text-muted">Dette arrangementet tar ikke påmelding.</p>}
                    </EventSidebarSection>

                    {event.takesPayment && (
                        <EventPaymentSection
                            event={event}
                            registration={ownRegistration}
                            userId={session.user?.id ?? null}
                            availableBalance={data.eventPaymentBalance}
                            customerSessionClientSecret={data.eventPaymentCustomerSessionSecret}
                            capabilities={{ canPay: capabilities.canPay }}
                        />
                    )}
                </aside>
                <main className="
                    flex-[999_1_420px]
                    max-mobile:basis-full
                    min-w-0 p-4 bg-surface-base rounded-round
                ">
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
