'use client'
import EventLocationInput from './EventLocationInput'
import Checkbox from '@/components/UI/Checkbox'
import { SelectString, SelectNumberPossibleNULL } from '@/components/UI/Select'
import DateInput from '@/components/UI/DateInput'
import Slider from '@/components/UI/Slider'
import NumberInput from '@/components/UI/NumberInput'
import Form from '@/components/Form/Form'
import FormSection from '@/components/Form/FormSection'
import TextInput from '@/components/UI/TextInput'
import EventTag from '@/components/Event/EventTag'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { createEventAction, updateEventAction } from '@/services/events/actions'
import { eventCanBeViewedByOptions } from '@/services/events/constants'
import { FIELD_IS_PRESENT_VALUE } from '@/lib/fields/constants'
import { configureAction } from '@/services/configureAction'
import { eventHref } from '@/components/Event/Pages/eventPages'
import { useState } from 'react'
import type { VisibilityRequirement } from '@/services/visibility/types'
import type {
    Event,
    EventLocationMap,
    EventTag as EventTagT,
    Committee,
    SpecialEventTags,
} from '@/prisma-generated-pn-types'

type PropTypes = {
    event?: Pick<Event,
        'id' | 'name' | 'location' | 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'hostedByCommitteeId'
        | 'waitingList' | 'bindingRegistration' | 'takesPayment' | 'paymentStart' | 'paymentEnd'
    > & { tags: EventTagT[], locationMap: EventLocationMap | null }
    /** The event pages to navigate under once saved, which differ between Omega's site and the career site. */
    basePath: string
    /** A special tag the event must carry, as on the career site: checked, and not to be unchecked. */
    lockedTag?: SpecialEventTags | null
    eventTags: EventTagT[]
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null
}

/**
 * Creates an event, or updates the one given. Who administrates it, and its first quota - the
 * registration with its places, period, price and who may register - are only set here when
 * creating: an existing event has them in the visibility and quota pop-ups on its page.
 */
export default function CreateOrUpdateEventForm({ event, basePath, lockedTag = null, eventTags, committees }: PropTypes) {
    const [takesRegistration, setTakesRegistration] = useState(false)
    const [takesPayment, setTakesPayment] = useState(event?.takesPayment ?? false)
    const [adminRequirements, setAdminRequirements] = useState<VisibilityRequirement[]>([])
    const [quotaRequirements, setQuotaRequirements] = useState<VisibilityRequirement[]>([])
    const action = event ? configureAction(updateEventAction, { params: { id: event.id } }) : createEventAction

    return (
        <Form
            title={event ? 'Endre arrangement' : 'Nytt arrangement'}
            className="min-w-[min(80vw,48rem)]"
            closePopUpOnSuccess="EditEvent"
            action={action}
            submitText={event ? 'Oppdater' : 'Opprett'}
            refreshOnSuccess
            navigateOnSuccess={data => (data?.name ? eventHref(basePath, data) : basePath)}
        >
            <FormSection legend="Om arrangementet" columns={2}>
                <TextInput label="Navn" name="name" defaultValue={event?.name} />
                <TextInput label="Sted" name="location" defaultValue={event?.location ?? ''} />
                <DateInput label="Start" name="eventStart" includeTime defaultValue={event?.eventStart} />
                <DateInput label="Slutt" name="eventEnd" includeTime defaultValue={event?.eventEnd} />
                {/*
                  * Left out when the committees could not be read: offered without the committee
                  * of the event, the select would submit its first option and clear it.
                  */}
                {committees && <SelectNumberPossibleNULL
                    label="Arrangeres av"
                    name="hostedByCommitteeId"
                    options={[
                        { value: 'NULL', label: 'Ingen komité' },
                        ...committees.map(committee => ({ value: committee.id, label: committee.name })),
                    ]}
                    defaultValue={event?.hostedByCommitteeId ?? 'NULL'}
                />}
            </FormSection>

            <FormSection legend="Tagger">
                <ul className="
                    m-0 p-0 flex flex-row flex-wrap gap-x-6 list-none
                    [&_li]:flex [&_li]:items-center [&_li]:z-1
                    [&_li:hover]:z-2
                ">
                    {eventTags.map(tag => {
                        const locked = lockedTag !== null && tag.special === lockedTag
                        const checked = locked || (event?.tags.some(eventTag => eventTag.id === tag.id) ?? false)

                        return (
                            <li key={tag.id}>
                                <Checkbox
                                    name="tagIds"
                                    value={tag.id}
                                    disabled={locked}
                                    defaultChecked={checked}
                                >
                                    <EventTag eventTag={tag} />
                                </Checkbox>
                                {/* A disabled checkbox submits nothing, so the locked tag is sent by a hidden field. */}
                                {locked && <input type="hidden" name="tagIds" value={tag.id} />}
                            </li>
                        )
                    })}
                </ul>
            </FormSection>

            <EventLocationInput name="locationMap" defaultValue={event?.locationMap} />

            <FormSection legend="Synlighet">
                <SelectString
                    className="max-w-[300px]"
                    label="Hvem kan se arrangementet"
                    name="canBeViewedBy"
                    options={eventCanBeViewedByOptions}
                    defaultValue={event?.canBeViewedBy}
                />
                {!event && <>
                    <p className="m-0 font-medium">Hvem kan administrere arrangementet</p>
                    <VisibilityMatrixEditor requirements={adminRequirements} onChange={setAdminRequirements} />
                    <input type="hidden" name="visibilityAdminRequirements" value={JSON.stringify(adminRequirements)} />
                </>}
            </FormSection>

            {event ? (
                <FormSection legend="Påmelding" columns={2}>
                    <p className="m-0 col-span-full text-s text-text-muted">
                        Plasser, påmeldingsperiode, pris og hvem som kan melde seg på settes per kvote i kvote-popupen.
                    </p>
                    <Slider label="Venteliste" name="waitingList" defaultChecked={event.waitingList} />
                    <Slider
                        label="Bindende påmelding"
                        name="bindingRegistration"
                        defaultChecked={event.bindingRegistration}
                    />
                    <Slider
                        label="Tar betaling"
                        name="takesPayment"
                        onChange={changeEvent => setTakesPayment(changeEvent.target.checked)}
                        defaultChecked={event.takesPayment}
                    />
                    {takesPayment && <>
                        <DateInput
                            label="Betalingsstart"
                            name="paymentStart"
                            defaultValue={event.paymentStart ?? undefined}
                            includeTime
                        />
                        <DateInput
                            label="Betalingsslutt"
                            name="paymentEnd"
                            defaultValue={event.paymentEnd ?? undefined}
                            includeTime
                        />
                    </>}
                </FormSection>
            ) : (
                <FormSection legend="Påmelding" columns={2}>
                    <Slider
                        label="Med påmelding"
                        name="takesRegistration"
                        onChange={changeEvent => setTakesRegistration(changeEvent.target.checked)}
                    />
                    {takesRegistration ? <>
                        <NumberInput label="Plasser" name="places" min={0} />
                        <Slider label="Venteliste" name="waitingList" />
                        <Slider label="Bindende påmelding" name="bindingRegistration" />
                        <DateInput label="Påmeldingsstart" name="registrationStart" includeTime />
                        <DateInput label="Påmeldingsslutt" name="registrationEnd" includeTime />
                        <div className="col-span-full flex flex-col gap-2">
                            <p className="m-0 font-medium">Hvem kan melde seg på (tomt betyr alle)</p>
                            <VisibilityMatrixEditor requirements={quotaRequirements} onChange={setQuotaRequirements} />
                            <input
                                type="hidden"
                                name="quotaVisibilityRequirements"
                                value={JSON.stringify(quotaRequirements)}
                            />
                            <p className="m-0 text-s text-text-muted">
                                Dette blir den første kvoten. Flere kvoter legges til på arrangementets side.
                            </p>
                        </div>
                        <Slider
                            label="Tar betaling"
                            name="takesPayment"
                            onChange={changeEvent => setTakesPayment(changeEvent.target.checked)}
                        />
                        {takesPayment && <>
                            <NumberInput label="Pris" name="price" min={0} />
                            <DateInput label="Betalingsstart" name="paymentStart" includeTime />
                            <DateInput label="Betalingsslutt" name="paymentEnd" includeTime />
                        </>}
                    </> : <div hidden>
                        <input type="hidden" name="waitingList" value={FIELD_IS_PRESENT_VALUE} />
                        <input type="hidden" name="bindingRegistration" value={FIELD_IS_PRESENT_VALUE} />
                        <input type="hidden" name="takesPayment" value={FIELD_IS_PRESENT_VALUE} />
                    </div>}
                </FormSection>
            )}
        </Form>
    )
}
