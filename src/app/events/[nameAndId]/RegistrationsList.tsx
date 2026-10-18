'use client'
import styles from './RegistrationsList.module.scss'
import GiveDotPopUp from './GiveDotPopUp'
import GiveDotsToAbsentees from './GiveDotsToAbsentees'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { EventRegistrationPagingProvider, EventRegistrationPagingContext } from '@/contexts/paging/EventRegistrationPaging'
import UserCard from '@/components/User/UserCard'
import {
    EventRegistrationDetailedPagingProvider,
    EventRegistrationDetailedPagingContext,
} from '@/contexts/paging/EventRegistrationDetailedPaging'
import UserDisplayName from '@/components/User/UserDisplayName'
import Slider from '@/components/UI/Slider'
import Form from '@/components/Form/Form'
import ContactCard from '@/components/User/ContactCard'
import { destroyEventRegistrationAction, setEventAttendanceAction } from '@/services/events/registration/actions'
import { REGISTRATION_READER_TYPE } from '@/services/events/registration/constants'
import { configureAction } from '@/services/configureAction'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'
import Link from 'next/link'
import { useState } from 'react'
import type { EventFiltered } from '@/services/events/types'
import type { EventRegistrationNotAttended } from '@/services/events/registration/types'

function DetailedTable({
    event,
    type,
    attendanceTakerId,
    dotGiverId,
}: {
    event: EventFiltered,
    type: REGISTRATION_READER_TYPE,
    attendanceTakerId: number | null,
    dotGiverId: number | null,
}) {
    const columns = 6 + (attendanceTakerId !== null ? 1 : 0) + (dotGiverId !== null ? 1 : 0)

    return <EventRegistrationDetailedPagingProvider
        serverRenderedData={[]}
        startPage={{
            page: 0,
            pageSize: 50
        }}
        details={{
            eventId: event.id,
            type,
        }}
    >
        <div className={styles.RegistrationTable}>
            <table>
                <thead>
                    <tr>
                        <th>Navn</th>
                        <th>E-post</th>
                        <th>Mobil</th>
                        <th>Allergier</th>
                        <th>Notat</th>
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
                            const name = row.user ? <Link href={`/users/${row.user.username}`}>
                                <UserDisplayName user={row.user} width={20} />
                            </Link> : row.contact?.name
                            return <tr key={row.id}>
                                <td>{name}</td>
                                <td>{row.user ? row.user.email : row.contact?.email}</td>
                                <td>{row.user ? row.user.mobile : row.contact?.mobile}</td>
                                <td>{row.user ? row.user.allergies : 'Ukjent'}</td>
                                <td>{row.note}</td>
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
                                            destroyEventRegistrationAction,
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

function DefaultList({
    event,
    type,
}: {
    event: EventFiltered,
    type: REGISTRATION_READER_TYPE
}) {
    return <EventRegistrationPagingProvider
        serverRenderedData={[]}
        startPage={{
            page: 0,
            pageSize: 50
        }}
        details={{
            eventId: event.id,
            type,
        }}
    >
        <div className={styles.RegistrationsList}>
            <EndlessScroll
                pagingContext={EventRegistrationPagingContext}
                renderer={row => {
                    if (row.user) {
                        return <UserCard key={row.id} user={{
                            ...row.user,
                            image: row.image
                        }} className={styles.userCard} />
                    }
                    return <ContactCard key={row.id} name={row.contact?.name ?? 'Ukjent'} image={row.image} />
                }}
            />
        </div>
    </EventRegistrationPagingProvider>
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

    return <>
        <h4>Påmeldte</h4>
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
            attendanceTakerId={attendanceTakerId}
            dotGiverId={dotGiverId}
        /> : <DefaultList
            event={event}
            type={REGISTRATION_READER_TYPE.REGISTRATIONS}
        />}

        {event.waitingList && <>
            <h4>Venteliste</h4>
            {detailedView ? <DetailedTable
                event={event}
                type={REGISTRATION_READER_TYPE.WAITING_LIST}
                attendanceTakerId={attendanceTakerId}
                dotGiverId={dotGiverId}
            /> : <DefaultList
                event={event}
                type={REGISTRATION_READER_TYPE.WAITING_LIST}
            />}
        </>}
    </>
}
