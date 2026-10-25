'use client'
import EventLocationInput from './EventLocationInput'
import Checkbox from '@/components/UI/Checkbox'
import { SelectString, SelectNumberPossibleNULL } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Slider from '@/components/UI/Slider'
import NumberInput from '@/components/UI/NumberInput'
import Form from '@/components/Form/Form'
import TextInput from '@/components/UI/TextInput'
import EventTag from '@/components/Event/EventTag'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createEventAction, updateEventAction } from '@/services/events/actions'
import { eventCanBeViewedByOptions } from '@/services/events/constants'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'
import { configureAction } from '@/services/configureAction'
import { formatVevenUri } from '@/lib/urlEncoding'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'
import type { Event, EventLocationMap, EventTag as EventTagT, Committee } from '@/prisma-generated-pn-types'
import type { ChangeEvent } from 'react'

type PropTypes = {
    event?: Event & { tags: EventTagT[], locationMap: EventLocationMap | null }
    eventTags: EventTagT[]
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null
}

/**
 * If an event is provided, the form will update the event.
 * If no event is provided, the form will create a new event.
 * @param event - The event to update
 * @param eventTags - The tags to choose from
 * @returns
 */
export default function CreateOrUpdateEventForm({ event, eventTags, committees }: PropTypes) {
    const [showRegistrationOptions, setShowRegistrationOptions] = useState(event?.takesRegistration ?? false)
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])
    const [regularRequirements, setRegularRequirements] = useState<VisibilityRequirement[]>([])
    const action = event ? configureAction(updateEventAction, { params: { id: event.id } }) : createEventAction
    const canSetHostCommittee = committees !== null

    const handleShowRegistration = (changeEvent: ChangeEvent<HTMLInputElement>) => {
        setShowRegistrationOptions(changeEvent.target.checked)
    }

    return (
        <div className="min-w-[50vw] p-4">
            <h1>{event ? 'Endre' : 'Opprett'} arrangement</h1>
            <Form
                closePopUpOnSuccess="EditEvent"
                action={action}
                submitText={event ? 'Oppdater' : 'Opprett'}
                refreshOnSuccess
                navigateOnSuccess={
                    data => (data?.name ? `/events/${formatVevenUri(data.name, data.id)}` : '/events')
                }
            >
                <TextInput label="Navn" name="name" defaultValue={event?.name} />
                <TextInput label="Sted" name="location" defaultValue={event?.location ?? ''} />
                <EventLocationInput name="locationMap" defaultValue={event?.locationMap} />
                <SelectString
                    className="max-w-[300px]"
                    label="Hvem kan se"
                    name="canBeViewedBy"
                    options={eventCanBeViewedByOptions}
                    defaultValue={event?.canBeViewedBy}
                />
                <DateInput label="Start" name="eventStart" includeTime defaultValue={event?.eventStart} />
                <DateInput label="Slutt" name="eventEnd" includeTime defaultValue={event?.eventEnd} />
                <ul
                    className="
                        mt-[1em] flex flex-row flex-wrap gap-x-[2em] overflow-visible list-none
                        [&_h2]:flex-[1_1_100%]
                        [&_li]:flex [&_li]:items-center [&_li]:z-1
                        [&_li:hover]:z-2
                        [&_li_input[type=checkbox]]:align-top [&_li_input[type=checkbox]]:mr-[4px]
                    "
                >
                    <h2>Tagger</h2>
                    {
                        eventTags.map(tag => (
                            <li key={tag.id}>
                                <Checkbox
                                    name="tagIds"
                                    value={tag.id}
                                    defaultChecked={
                                        event
                                            ? event.tags.map(tagItem => tagItem.name).includes(tag.name)
                                            : false
                                    }
                                >
                                    <EventTag eventTag={tag} />
                                </Checkbox>
                            </li>
                        ))
                    }
                </ul>
                <Slider
                    label="Med påmelding"
                    name="takesRegistration"
                    onChange={handleShowRegistration}
                    defaultChecked={event?.takesRegistration}
                />

                {/*
                  * Only when creating: an existing event has both levels in the admin panel on its
                  * own page, where they are saved one at a time against the stored visibilities.
                  */}
                {!event && <div className="flex flex-col gap-[0.5rem]">
                    <h2>Hvem kan administrere arrangementet?</h2>
                    <VisibilityMatrixEditor
                        requirements={adminRequirements}
                        onChange={setAdminRequirements}
                    />
                    <input
                        type="hidden"
                        name="visibilityAdminRequirements"
                        value={JSON.stringify(adminRequirements)}
                    />
                    <h2>Hvem kan melde seg på? (tomt betyr alle)</h2>
                    <VisibilityMatrixEditor
                        requirements={regularRequirements}
                        onChange={setRegularRequirements}
                    />
                    <input
                        type="hidden"
                        name="visibilityRegularRequirements"
                        value={JSON.stringify(regularRequirements)}
                    />
                </div>}

                {showRegistrationOptions ? <>
                    <Slider
                        label="Venteliste"
                        name="waitingList"
                        defaultChecked={event?.waitingList}
                    />
                    <NumberInput
                        label="Plasser"
                        name="places"
                        defaultValue={event?.places}
                    />
                    <NumberInput
                        label="Pris (tom for gratis arrangement)"
                        name="price"
                        min={0}
                        defaultValue={event?.price ? event.price / 100 : undefined}
                    />
                    {/*
                      * Left out when the committees could not be read: offered without the committee
                      * of the event, the select would submit its first option and clear it.
                      */}
                    {canSetHostCommittee && <SelectNumberPossibleNULL
                        label="Arrangeres av"
                        name="hostedByCommitteeId"
                        options={[
                            { value: 'NULL', label: 'Ingen komité' },
                            ...committees.map(committee => ({ value: committee.id, label: committee.name })),
                        ]}
                        defaultValue={event?.hostedByCommitteeId ?? 'NULL'}
                    />}
                    <DateInput
                        label="Påmeldingsstart"
                        name="registrationStart"
                        defaultValue={event?.registrationStart}
                        includeTime
                    />
                    <DateInput
                        label="Påmeldingsslutt"
                        name="registrationEnd"
                        defaultValue={event?.registrationEnd}
                        includeTime
                    />
                    <DateInput
                        label="Betalingsstart"
                        name="paymentStart"
                        defaultValue={event?.paymentStart ?? undefined}
                        includeTime
                    />
                    <DateInput
                        label="Betalingsslutt"
                        name="paymentEnd"
                        defaultValue={event?.paymentEnd ?? undefined}
                        includeTime
                    />
                </> : <>
                    <input type="hidden" name="waitingList" value={FIELD_IS_PRESENT_VALUE} />
                </>}
            </Form>
        </div>
    )
}
