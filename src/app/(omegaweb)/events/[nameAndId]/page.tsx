import styles from './page.module.scss'
import ShowAndEditName from './ShowAndEditName'
import RegistrationUI from './RegistrationUI'
import RegistrationsList from './RegistrationsList'
import ManualRegistrationForm from './ManualRegistrationForm'
import EventVisibilityAdmin from './EventVisibilityAdmin'
import ConnectEventToLedgerForm from './ConnectEventToLedgerForm'
import EventLocationMap from '@/components/Event/EventLocationMap'
import DateDisplay from '@/components/Date/Date'
import CreateOrUpdateEventForm from '@/app/(omegaweb)/events/CreateOrUpdateEventForm'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import Form from '@/components/Form/Form'
import EventTag from '@/components/Event/EventTag'
import { SettingsHeaderItemPopUp, UsersHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { QueryParams } from '@/lib/queryParams/queryParams'
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
import { decodeVevenUriHandleError, formatVevenUri } from '@/lib/urlEncoding'
import { eventAuth } from '@/services/events/auth'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { Require } from '@/auth/authorizer/Require'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'
import { faCalendar, faExclamation, faLocationDot, faPeopleGroup, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
        const event = await eventOperations.read({
            params: {
                id: decodeVevenUriHandleError(params.nameAndId)
            }
        })

        const tags = await eventTagOperations.readAll({})

        // Only used to populate the "hosting committee" picker; a session without COMMITTEE_USE
        // gets no picker rather than losing the whole page.
        const committees = await withFallback(committeeOperations.readAll({}), null)

        // Readable only by those who administrate the event, so a visitor without that access
        // simply gets no editing tools - EMPTY_VISIBILITY then denies everyone but those bypassing
        // with EVENT_ADMIN, which is the safe direction to fail in.
        const doubleLevelVisibility = await withFallback(
            eventOperations.visibility.readDoubleLevelMatrix({ params: { id: event.id } }),
            null
        )

        // The accounts feed the control of those who administrate the event, so they are loaded
        // for no one else, and fall back to empty rather than taking the page down.
        const administers = eventAuth.update.data({
            visibility: doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }).auth(session).authorized
        const ledgerAccounts = administers
            ? await withFallback(ledgerAccountOperations.readAccessible({
                params: { includeGroupAccounts: true, includeUserAccounts: false },
            }), [])
            : []

        // What the dots of the one visiting hold them back from - nothing to tell a visitor
        // without a user, and nothing to hide either, as it is their own dots it is read from.
        const dotPunishment = event.takesRegistration && session.user
            ? await eventRegistrationOperations.readDotPunishmentOfUser({
                params: { userId: session.user.id },
            })
            : null

        // The registration of the one visiting, if they are registered - the same holds as for
        // the dots.
        const ownRegistration = event.takesRegistration && session.user
            ? await eventRegistrationOperations.readOfUser({
                params: { eventId: event.id, userId: session.user.id },
            })
            : null

        // What paying for the event out of pocket would take: the visitor's balance, and a
        // Stripe customer session for saved payment methods. Only relevant when the event is
        // priced and the visitor can register at all.
        let eventPaymentBalance: number | undefined
        let eventPaymentCustomerSessionSecret: string | undefined

        if (event.takesRegistration && event.price && session.user) {
            eventPaymentBalance = (await ledgerAccountOperations.calculateBalance({
                params: { userId: session.user.id },
            })).amount

            const customerSession = await withFallback(
                stripeCustomerOperations.createSession({ params: { userId: session.user.id } }),
                null
            )
            eventPaymentCustomerSessionSecret = customerSession?.customerSessionClientSecret
        }

        // Who did not show up, for giving them dots once the event is over. Readable only by those
        // who administrate the event, so a visitor without that access simply gets no list.
        const eventHasEnded = event.eventEnd < new Date()
        const notAttended = event.takesRegistration && eventHasEnded
            ? await withFallback(eventRegistrationOperations.readNotAttended({ params: { eventId: event.id } }), null)
            : null

        return {
            event,
            tags,
            committees,
            doubleLevelVisibility,
            ledgerAccounts,
            dotPunishment,
            ownRegistration,
            eventPaymentBalance,
            eventPaymentCustomerSessionSecret,
            notAttended,
        }
    },
    capabilities: (data, session) => ({
        canEditCmsCoverImage: eventAuth.updateCmsCoverImage.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canEditCmsParagraph: eventAuth.updateParagraphContent.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canDestroy: eventAuth.destroy.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canUpdate: eventAuth.update.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canUpdateVisibility: Require.anyOf(
            eventAuth.updateRegularLevel.data({ visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY }),
            eventAuth.updateAdminLevel.data({ visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY }),
            eventAuth.setPublished.data({ visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY }),
        ),
        canConnectToLedgerAccount: eventAuth.connectToLedgerAccount.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
            accounts: data.ledgerAccounts.map(account => account.ownership),
        }),
        // Reading who is registered takes the regular level of the event (its admin level while
        // it is a draft), and registering on behalf of others its admin level - offering any of
        // it to someone without the level would only produce an error when they act on it.
        canReadRegistrations: eventRegistrationAuth.readPage.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
            published: data.event.published,
        }),
        canReadRegistrationsDetailed: eventRegistrationAuth.readPageDetailed.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canRegisterAsAdmin: eventRegistrationAuth.createAsAdmin.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canRegisterGuest: eventRegistrationAuth.createGuest.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canTakeAttendance: session.user ? eventRegistrationAuth.registerAttendance.data({
            userId: session.user.id,
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }) : Require.user(),
        // Dots for the event are given in the name of the session's own user, by its admin level.
        canGiveDots: session.user ? eventRegistrationAuth.createDot.data({
            userId: session.user.id,
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }) : Require.user(),
        // Registering takes the regular level of the event (its admin level while it is a draft),
        // for the session's own user.
        canRegister: session.user ? eventRegistrationAuth.create.data({
            userId: session.user.id,
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
            published: data.event.published,
        }) : Require.user(),
    }),
    metadata: (data) => ({ title: data.event.name }),
    render: ({ data, capabilities, session }) => {
        const { event, tags, committees, doubleLevelVisibility, ledgerAccounts, dotPunishment, ownRegistration } = data
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
                        <ShowAndEditName event={event} capabilities={{ canUpdate: capabilities.canUpdate.toJsObject() }} />
                        <ul className="
                            list-none flex flex-wrap gap-x-[1em] gap-y-0
                            [&_a]:no-underline
                        ">
                            {event.tags.map(tag => (
                                <li key={tag.id}>
                                    <Link href={`/events?${QueryParams.eventTags.encodeUrl([tag.name])}`}>
                                        <EventTag eventTag={tag} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={`
                        ${styles.overlay}
                        absolute top-2 right-2 z-1 flex gap-2
                        [&_svg]:size-14
                    `}>
                        {event.takesRegistration && (
                            capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized
                        ) &&
                            <UsersHeaderItemPopUp scale={30} popUpKey="Users">
                                <ManualRegistrationForm
                                    eventId={event.id}
                                    capabilities={{
                                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin.toJsObject(),
                                        canRegisterGuest: capabilities.canRegisterGuest.toJsObject(),
                                    }}
                                />
                            </UsersHeaderItemPopUp>
                        }
                        {(
                            capabilities.canUpdate.authorized
                            || capabilities.canConnectToLedgerAccount.authorized
                            || capabilities.canUpdateVisibility.authorized
                            || capabilities.canDestroy.authorized
                            || (event.takesRegistration && capabilities.canTakeAttendance.authorized)
                        ) && (
                            <SettingsHeaderItemPopUp scale={30} popUpKey="EditEvent">
                                {capabilities.canUpdate.authorized &&
                                    <CreateOrUpdateEventForm event={event} eventTags={tags} committees={committees} />
                                }
                                {capabilities.canConnectToLedgerAccount.authorized && <>
                                    <p>
                                        Konto: {event.ledgerAccount
                                            ? (event.ledgerAccount.name ?? `Konto ${event.ledgerAccount.id}`)
                                            : 'ingen. Betaling fungerer ikke før arrangementet er knyttet til en konto.'}
                                    </p>
                                    <ConnectEventToLedgerForm
                                        eventId={event.id}
                                        currentLedgerAccountId={event.ledgerAccountId}
                                        ledgerAccounts={ledgerAccounts}
                                    />
                                </>}
                                <EventVisibilityAdmin event={event} doubleLevelVisibility={doubleLevelVisibility} />
                                {event.takesRegistration && capabilities.canTakeAttendance.authorized &&
                                    <Link
                                        className="block p-2 text-center rounded-round bg-surface-raised text-text"
                                        href={`/events/${formatVevenUri(event.name, event.id)}/attendance`}
                                    >
                                        Registrer oppmøte
                                    </Link>
                                }
                                { capabilities.canDestroy.authorized &&
                                    <Form
                                        action={configureAction(destroyEventAction, { params: { id: event.id } })}
                                        navigateOnSuccess="/events"
                                        submitText="Slett"
                                        submitColor="red"
                                        confirmation={{
                                            confirm: true,
                                            text: 'Er du sikker på at du vil slette dette arrangementet?'
                                        }}
                                    />
                                }
                            </SettingsHeaderItemPopUp>
                        )}
                    </div>
                </span>
                <aside className="
                    flex-[1_1_650px]
                    max-mobile:basis-full
                    bg-surface-base rounded-round pt-8 px-8 pb-2 flex flex-col gap-4
                    [&>p]:flex [&>p]:items-center [&>p]:gap-[1em] [&>p]:text-l
                    [&>p_svg]:size-[1.5em]
                ">
                    <p>
                        <FontAwesomeIcon icon={faCalendar} />
                        <DateDisplay date={event.eventStart} includeTime />
                        {' - '}
                        <DateDisplay date={event.eventEnd} includeTime />
                    </p>
                    <p>
                        <FontAwesomeIcon icon={faLocationDot} />
                        {event.location}
                    </p>
                    {event.hostedByCommittee && <p>
                        <FontAwesomeIcon icon={faPeopleGroup} />
                        <span>
                            Arrangeres av <Link href={`/committees/${event.hostedByCommittee.shortName}`}>
                                {event.hostedByCommittee.name}
                            </Link>
                        </span>
                    </p>}
                    {event.takesRegistration ? <>
                        <p>
                            <FontAwesomeIcon icon={faUsers} />
                            {event.numOfRegistrations} / {event.places}
                        </p>
                        <p>
                            Påmeldingsstart: <DateDisplay date={event.registrationStart} includeTime />
                        </p>
                        <p>
                            Påmeldingsslutt: <DateDisplay date={event.registrationEnd} includeTime />
                        </p>
                        {event.waitingList && <p>
                            På venteliste: {event.numOnWaitingList}
                        </p>}
                        <RegistrationUI
                            event={event}
                            registration={ownRegistration}
                            dotPunishment={dotPunishment}
                            availableBalance={data.eventPaymentBalance}
                            customerSessionClientSecret={data.eventPaymentCustomerSessionSecret}
                            capabilities={{
                                canRegister: capabilities.canRegister.toJsObject(),
                                canRegisterAsAdmin: capabilities.canRegisterAsAdmin.toJsObject(),
                            }}
                        />
                    </> : <p>
                        <FontAwesomeIcon icon={faExclamation} />
                        Dette arrangementet tar ikke påmeldinger
                    </p>}

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

export default page
export { generateMetadata }
