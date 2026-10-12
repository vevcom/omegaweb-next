import styles from './page.module.scss'
import ShowAndEditName from './ShowAndEditName'
import RegistrationUI from './RegistrationUI'
import RegistrationsList from './RegistrationsList'
import ManualRegistrationForm from './ManualRegistrationForm'
import EventVisibilityAdmin from './EventVisibilityAdmin'
import EventLocationMap from '@/components/Event/EventLocationMap'
import Date from '@/components/Date/Date'
import CreateOrUpdateEventForm from '@/app/events/CreateOrUpdateEventForm'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import CmsParagraph from '@/components/Cms/CmsParagraph/CmsParagraph'
import Form from '@/components/Form/Form'
import EventTag from '@/components/Event/EventTag'
import { SettingsHeaderItemPopUp, UsersHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { eventTagOperations } from '@/services/events/tags/operations'
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
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { Require } from '@/auth/authorizer/Require'
import { serverPage, withFallback } from '@/app/serverPage'
import Link from 'next/link'
import { faCalendar, faExclamation, faLocationDot, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
        const event = await eventOperations.read({
            params: {
                id: decodeVevenUriHandleError(params.nameAndId)
            }
        })

        const tags = await eventTagOperations.readAll({})

        // Readable only by those who administrate the event, so a visitor without that access
        // simply gets no editing tools - EMPTY_VISIBILITY then denies everyone but those bypassing
        // with EVENT_ADMIN, which is the safe direction to fail in.
        const doubleLevelVisibility = await withFallback(
            eventOperations.visibility.readDoubleLevelMatrix({ params: { id: event.id } }),
            null
        )

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

        return {
            event,
            tags,
            doubleLevelVisibility,
            dotPunishment,
            ownRegistration,
            eventPaymentBalance,
            eventPaymentCustomerSessionSecret,
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
        // Reading who is registered takes the regular level of the event, and registering on
        // behalf of others its admin level - offering any of it to someone without the level
        // would only produce an error when they act on it.
        canReadRegistrations: eventRegistrationAuth.readPage.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canRegisterOthers: eventRegistrationAuth.createGuest.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        // Registering takes the regular level of the event, for the session's own user.
        canRegister: session.user ? eventRegistrationAuth.create({
            userId: session.user.id,
            doubleLevelMatrix: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }) : Require.user(),
    }),
    metadata: (data) => ({ title: data.event.name }),
    render: ({ data, capabilities }) => {
        const { event, tags, doubleLevelVisibility, dotPunishment, ownRegistration } = data

        return (
            <div className={styles.wrapper}>
                <span className={styles.coverImage}>
                    <CmsImage
                        capabilities={{ canEdit: capabilities.canEditCmsCoverImage }}
                        cmsImage={event.coverImage}
                        width={900}
                        updateCmsImageAction={
                            configureAction(
                                updateEventCmsCoverImageAction,
                                { implementationParams: { eventId: event.id } }
                            )}
                    />
                    <div className={styles.infoInImage}>
                        <ShowAndEditName event={event} />
                        <ul className={styles.tags}>
                            {event.tags.map(tag => (
                                <li key={tag.id}>
                                    <Link href={`/events?${QueryParams.eventTags.encodeUrl([tag.name])}`}>
                                        <EventTag eventTag={tag} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.settings}>
                        {event.takesRegistration && capabilities.canRegisterOthers.authorized &&
                            <UsersHeaderItemPopUp scale={30} popUpKey="Users">
                                <ManualRegistrationForm eventId={event.id} />
                            </UsersHeaderItemPopUp>
                        }
                        <SettingsHeaderItemPopUp scale={30} popUpKey="EditEvent">
                            <CreateOrUpdateEventForm event={event} eventTags={tags} />
                            <EventVisibilityAdmin event={event} doubleLevelVisibility={doubleLevelVisibility} />
                            { capabilities.canDestroy.authorized &&
                                <Form
                                    action={configureAction(destroyEventAction, { params: { id: event.id } })}
                                    navigateOnSuccess="/events"
                                    className={styles.destroyForm}
                                    buttonClassName={styles.destroyButton}
                                    submitText="Slett"
                                    submitColor="red"
                                    confirmation={{
                                        confirm: true,
                                        text: 'Er du sikker på at du vil slette dette arrangementet?'
                                    }}
                                />
                            }
                        </SettingsHeaderItemPopUp>
                    </div>
                </span>
                <aside>
                    <p>
                        <FontAwesomeIcon icon={faCalendar} />
                        <Date date={event.eventStart} includeTime /> - <Date date={event.eventEnd} includeTime />
                    </p>
                    <p>
                        <FontAwesomeIcon icon={faLocationDot} />
                        {event.location}
                    </p>
                    {event.takesRegistration ? <>
                        <p>
                            <FontAwesomeIcon icon={faUsers} />
                            {event.numOfRegistrations} / {event.places}
                        </p>
                        <p>
                            Påmelding start: <Date date={event.registrationStart} includeTime />
                        </p>
                        <p>
                            Påmelding slutt: <Date date={event.registrationEnd} includeTime />
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
                            capabilities={{ canRegister: capabilities.canRegister.toJsObject() }}
                        />
                    </> : <p>
                        <FontAwesomeIcon icon={faExclamation} />
                        Dette arrangementet tar ikke påmeldinger
                    </p>}

                </aside>
                <main>
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
                    <div className={styles.registrationList}>
                        <RegistrationsList event={event} />
                    </div>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
