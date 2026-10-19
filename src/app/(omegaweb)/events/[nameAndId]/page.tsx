import styles from './page.module.scss'
import ShowAndEditName from './ShowAndEditName'
import RegistrationsList from './RegistrationsList'
import ManualRegistrationForm from './ManualRegistrationForm'
import EventVisibilityAdmin from './EventVisibilityAdmin'
import ConnectEventToLedgerForm from './ConnectEventToLedgerForm'
import EventDetails from '@/components/Event/EventDetails'
import EventDescription from '@/components/Event/EventDescription'
import { eventRegistrationCapabilities, readEventRegistrationPageData } from '@/components/Event/eventPageData'
import CreateOrUpdateEventForm from '@/app/(omegaweb)/events/CreateOrUpdateEventForm'
import CmsImage from '@/components/Cms/CmsImage/CmsImage'
import Form from '@/components/Form/Form'
import EventTag from '@/components/Event/EventTag'
import { SettingsHeaderItemPopUp, UsersHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { eventTagOperations } from '@/services/events/tags/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { companyOperations } from '@/services/career/companies/operations'
import { destroyEventAction, updateEventCmsCoverImageAction } from '@/services/events/actions'
import { eventOperations } from '@/services/events/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { configureAction } from '@/services/configureAction'
import { decodeVevenUriHandleError, formatVevenUri } from '@/lib/urlEncoding'
import { eventAuth } from '@/services/events/auth'
import { eventRegistrationAuth } from '@/services/events/registration/auth'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import { Require } from '@/auth/authorizer/Require'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'
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
        // The same goes for the companies of the company picker, which takes COMPANY_USE besides:
        // without it there is no picker (null), rather than one that would clear the company.
        const companies = administers ? await withFallback(companyOperations.readAll({}), null) : null

        return {
            event,
            tags,
            committees,
            companies,
            doubleLevelVisibility,
            ledgerAccounts,
            registration: await readEventRegistrationPageData(event, session),
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
        canConnectToLedger: eventAuth.connectToLedger.data({
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
        canRegisterGuest: eventRegistrationAuth.createGuest.data({
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }),
        canTakeAttendance: session.user ? eventRegistrationAuth.registerAttendance.data({
            userId: session.user.id,
            visibility: data.doubleLevelVisibility ?? EMPTY_VISIBILITY,
        }) : Require.user(),
        ...eventRegistrationCapabilities(data, session),
    }),
    metadata: (data) => ({ title: data.event.name }),
    render: ({ data, capabilities, session }) => {
        const { event, tags, committees, companies, doubleLevelVisibility, ledgerAccounts, registration } = data
        const attendanceTakerId = capabilities.canTakeAttendance.authorized && session.user ? session.user.id : null

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
                        <ShowAndEditName event={event} capabilities={{ canUpdate: capabilities.canUpdate.toJsObject() }} />
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
                        <SettingsHeaderItemPopUp scale={30} popUpKey="EditEvent">
                            {capabilities.canUpdate.authorized &&
                                <CreateOrUpdateEventForm
                                    event={event}
                                    eventTags={tags}
                                    committees={committees}
                                    companies={companies}
                                />
                            }
                            {capabilities.canConnectToLedger.authorized && <>
                                <p>
                                    Konto: {event.ledgerAccount
                                        ? (event.ledgerAccount.name ?? `Konto ${event.ledgerAccount.id}`)
                                        : 'ingen. Betaling feiler til arrangementet er knyttet til en konto.'}
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
                                    className={styles.attendanceLink}
                                    href={`/events/${formatVevenUri(event.name, event.id)}/attendance`}
                                >
                                    Registrer oppmøte
                                </Link>
                            }
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
                <EventDetails
                    className={styles.details}
                    event={event}
                    {...registration}
                    capabilities={{
                        canRegister: capabilities.canRegister,
                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin,
                    }}
                />
                <main>
                    <EventDescription event={event} capabilities={{ canEdit: capabilities.canEditCmsParagraph }} />
                </main>

                {event.takesRegistration && capabilities.canReadRegistrations.authorized && (
                    <div className={styles.registrationList}>
                        <RegistrationsList
                            event={event}
                            canReadDetailed={capabilities.canReadRegistrationsDetailed.authorized}
                            attendanceTakerId={attendanceTakerId}
                        />
                    </div>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
