'use client'
import GiveDotPopUp from './GiveDotPopUp'
import GiveDotsToAbsentees from './GiveDotsToAbsentees'
import MoveToQuotaForm from './MoveToQuotaForm'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { EventRegistrationPagingProvider, EventRegistrationPagingContext } from '@/contexts/paging/EventRegistrationPaging'
import UserCard from '@/components/User/UserCard'
import {
    EventRegistrationDetailedPagingProvider,
    EventRegistrationDetailedPagingContext,
} from '@/contexts/paging/EventRegistrationDetailedPaging'
import UserDisplayName from '@/components/User/UserDisplayName'
import { omegaLinks } from '@/app/(omegaweb)/links'
import Slider from '@/components/UI/Slider'
import TextInput from '@/components/UI/TextInput'
import { useDebounce } from '@/hooks/useDebounce'
import { searchMaxLength } from '@/services/search/constants'
import Form from '@/components/Form/Form'
import ContactCard from '@/components/User/ContactCard'
import {
    destroyEventRegistrationAsAdminAction,
    moveEventRegistrationAction,
    setEventAttendanceAction,
    setEventRegistrationManuallyPaidAction,
} from '@/services/events/registration/actions'
import { REGISTRATION_READER_TYPE } from '@/services/events/registration/constants'
import { configureAction } from '@/services/configureAction'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp } from '@fortawesome/free-solid-svg-icons'
import { useContext, useState } from 'react'
import type { EventFiltered } from '@/services/events/types'
import type { EventRegistrationNotAttended } from '@/services/events/registration/types'

const SEARCH_DEBOUNCE_MS = 300

function DetailedTable({
    event,
    type,
    search,
    attendanceTakerId,
    dotGiverId,
}: {
    event: EventFiltered,
    type: REGISTRATION_READER_TYPE,
    search: string,
    attendanceTakerId: number | null,
    dotGiverId: number | null,
}) {
    const onWaitingList = type === REGISTRATION_READER_TYPE.WAITING_LIST
    const severalVariants = event.variants.length > 1
    const severalQuotas = event.variants.some(variant => variant.quotas.length > 1)
    const columns = 7 + (severalVariants ? 1 : 0) + (severalQuotas ? 1 : 0) + (event.takesPayment ? 1 : 0)
        + (attendanceTakerId !== null ? 1 : 0) + (dotGiverId !== null ? 1 : 0)
    const quotasOfVariant = (variantId: number | undefined) =>
        event.variants.find(variant => variant.id === variantId)?.quotas ?? []

    return <EventRegistrationDetailedPagingProvider
        key={search}
        serverRenderedData={[]}
        startPage={{
            page: 0,
            pageSize: 50
        }}
        details={{
            eventId: event.id,
            type,
            search,
        }}
    >
        <div className="block overflow-x-auto overflow-y-visible">
            <table className="
                ohma-table
                [&_a]:no-underline [&_a]:text-inherit
            ">
                <thead>
                    <tr>
                        <th>Flytt</th>
                        {severalVariants && <th>Variant</th>}
                        {severalQuotas && <th>Kvote</th>}
                        <th>Navn</th>
                        <th>E-post</th>
                        <th>Mobil</th>
                        <th>Allergier</th>
                        <th>Notat</th>
                        {event.takesPayment && <th>Betalt</th>}
                        {attendanceTakerId !== null && <th>Møtt</th>}
                        {dotGiverId !== null && <th>Prikk</th>}
                        <th>Slett</th>
                    </tr>
                </thead>
                <tbody>
                    <EndlessScroll
                        pagingContext={EventRegistrationDetailedPagingContext}
                        loadingInfoWrapper={loadingInfo => <tr><td colSpan={columns}>{loadingInfo}</td></tr>}
                        renderer={row => {
                            const name = row.user ? <SiteLink href={omegaLinks.user(row.user)}>
                                <UserDisplayName user={row.user} width={20} />
                            </SiteLink> : row.contact?.name
                            return <tr key={row.id}>
                                <td>
                                    <div className="flex gap-1">
                                        {/* The waiting list is a queue; a place is only given by a freed one or by hand. */}
                                        {onWaitingList && (['UP', 'DOWN'] as const).map(direction => <Form
                                            key={direction}
                                            action={configureAction(
                                                moveEventRegistrationAction,
                                                { params: { registrationId: row.id, direction } }
                                            )}
                                            submitText={
                                                <FontAwesomeIcon icon={direction === 'UP' ? faArrowUp : faArrowDown} />
                                            }
                                            buttonClassName="w-auto!"
                                            refreshOnSuccess
                                        />)}
                                        {(onWaitingList || severalQuotas) && <MoveToQuotaForm
                                            registrationId={row.id}
                                            currentQuotaId={row.quota?.id ?? null}
                                            quotas={quotasOfVariant(row.quota?.variant.id ?? row.waitingListVariant?.id)}
                                        />}
                                    </div>
                                </td>
                                {severalVariants && <td>{row.quota?.variant.name ?? row.waitingListVariant?.name}</td>}
                                {severalQuotas && <td>{row.quota?.name}</td>}
                                <td>{name}</td>
                                <td>{row.user ? row.user.email : row.contact?.email}</td>
                                <td>{row.user ? row.user.mobile : row.contact?.mobile}</td>
                                <td>{row.user ? row.user.allergies : 'Ukjent'}</td>
                                <td>{row.note}</td>
                                {event.takesPayment && <td>
                                    {row.ledgerTransactions.length > 0 ? 'Ja' : <Form
                                        action={configureAction(
                                            setEventRegistrationManuallyPaidAction,
                                            { params: { registrationId: row.id } }
                                        )}
                                        submitText={row.manuallyPaid ? 'Fjern betalt' : 'Marker betalt'}
                                        submitColor={row.manuallyPaid ? 'red' : 'green'}
                                        buttonClassName="w-auto!"
                                        refreshOnSuccess
                                    >
                                        <input
                                            type="hidden"
                                            name="manuallyPaid"
                                            value={row.manuallyPaid ? FIELD_IS_PRESENT_VALUE : 'on'}
                                        />
                                    </Form>}
                                </td>}
                                {attendanceTakerId !== null && <td>
                                    <Form
                                        action={configureAction(
                                            setEventAttendanceAction,
                                            { params: { registrationId: row.id, registeredById: attendanceTakerId } }
                                        )}
                                        submitText={row.attendedAt ? 'Fjern møtt' : 'Møtt'}
                                        submitColor={row.attendedAt ? 'red' : 'green'}
                                        refreshOnSuccess
                                    >
                                        <input
                                            type="hidden"
                                            name="attended"
                                            value={row.attendedAt ? FIELD_IS_PRESENT_VALUE : 'on'}
                                        />
                                    </Form>
                                </td>}
                                {dotGiverId !== null && <td>
                                    {row.user && <GiveDotPopUp
                                        eventId={event.id}
                                        accuserId={dotGiverId}
                                        userId={row.user.id}
                                        popUpKey={`giveDot-${row.id}`}
                                    />}
                                </td>}
                                <td>
                                    <Form
                                        action={configureAction(
                                            destroyEventRegistrationAsAdminAction,
                                            { params: { registrationId: row.id } }
                                        )}
                                        submitText="Slett"
                                        submitColor="red"
                                        confirmation={{
                                            confirm: true,
                                            text: 'Er du sikker på at du vil slette denne påmeldingen?'
                                        }}
                                    />
                                </td>
                            </tr>
                        }}
                    />
                </tbody>
            </table>
        </div>
    </EventRegistrationDetailedPagingProvider>
}

/** Says when a search found no one. It sits inside the paging provider to know. */
function NoMatches({ search }: { search: string }) {
    const paging = useContext(EventRegistrationPagingContext)
    if (!search || !paging?.state.allLoaded || paging.state.data.length > 0) return null
    return <p className="m-0 text-base-content/80">Ingen treff.</p>
}

function RegistrationCards({ eventId, type, variantId, search }: {
    eventId: number,
    type: REGISTRATION_READER_TYPE,
    variantId?: number,
    search: string,
}) {
    return <EventRegistrationPagingProvider
        key={search}
        serverRenderedData={[]}
        startPage={{
            page: 0,
            pageSize: 50
        }}
        details={{ eventId, type, variantId, search }}
    >
        <NoMatches search={search} />
        <div className="
            w-full grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-2
            [&>:last-child]:col-span-full
        ">
            <EndlessScroll
                pagingContext={EventRegistrationPagingContext}
                renderer={row => {
                    if (row.user) {
                        return <UserCard key={row.id} user={{
                            ...row.user,
                            image: row.image
                        }} />
                    }
                    return <ContactCard key={row.id} name={row.contact?.name ?? 'Ukjent'} image={row.image} />
                }}
            />
        </div>
    </EventRegistrationPagingProvider>
}

/** With several variants, each gets its own list, so friends can see where someone is. */
function DefaultList({ event, type, search }: {
    event: EventFiltered,
    type: REGISTRATION_READER_TYPE,
    search: string,
}) {
    if (event.variants.length < 2) return <RegistrationCards eventId={event.id} type={type} search={search} />

    const countOf = (variant: EventFiltered['variants'][number]) => (
        type === REGISTRATION_READER_TYPE.WAITING_LIST ? variant.numOnWaitingList : variant.numOfRegistrations
    )
    return <div className="flex flex-col gap-3 w-full">
        {event.variants.filter(variant => countOf(variant) > 0).map(variant => <section
            key={variant.id}
            className="flex flex-col gap-2"
        >
            <h5 className="m-0 text-l font-bold">
                {variant.name} {!search && <span className="font-normal text-base-content/80">({countOf(variant)})</span>}
            </h5>
            <RegistrationCards
                eventId={event.id}
                type={type}
                variantId={variant.id}
                search={search}
            />
        </section>)}
    </div>
}

export default function RegistrationsList({
    event,
    canReadDetailed,
    attendanceTakerId,
    dotGiverId,
    notAttended,
}: {
    event: EventFiltered,
    canReadDetailed: boolean,
    attendanceTakerId: number | null,
    /** The session's user when they may give dots for the event, like attendanceTakerId. */
    dotGiverId: number | null,
    /** Who did not show up, once the event is over - null while it is not, or for those who may not give dots. */
    notAttended: EventRegistrationNotAttended[] | null,
}) {
    const [detailedView, setDetailedView] = useState(false)
    const [search, setSearch] = useState('')
    const changeSearch = useDebounce(setSearch, SEARCH_DEBOUNCE_MS)

    return <>
        <h4>Påmeldte</h4>
        <TextInput
            label="Søk etter navn"
            name="registrationSearch"
            maxLength={searchMaxLength}
            onChange={changeEvent => changeSearch(changeEvent.target.value.trim())}
            className="max-w-none! mt-0!"
        />
        {dotGiverId !== null && notAttended && notAttended.length > 0 && <GiveDotsToAbsentees
            eventId={event.id}
            accuserId={dotGiverId}
            notAttended={notAttended}
        />}
        {canReadDetailed && <Slider
            label="Detaljert visning"
            name="detailedView"
            onChange={e => setDetailedView(e.target.checked)}
            checked={detailedView}
        />}
        {detailedView ? <DetailedTable
            event={event}
            type={REGISTRATION_READER_TYPE.REGISTRATIONS}
            search={search}
            attendanceTakerId={attendanceTakerId}
            dotGiverId={dotGiverId}
        /> : <DefaultList
            event={event}
            type={REGISTRATION_READER_TYPE.REGISTRATIONS}
            search={search}
        />}

        {event.waitingList && <>
            <h4>Venteliste</h4>
            {detailedView ? <DetailedTable
                event={event}
                type={REGISTRATION_READER_TYPE.WAITING_LIST}
                search={search}
                attendanceTakerId={attendanceTakerId}
                dotGiverId={dotGiverId}
            /> : <DefaultList
                event={event}
                type={REGISTRATION_READER_TYPE.WAITING_LIST}
                search={search}
            />}
        </>}
    </>
}
