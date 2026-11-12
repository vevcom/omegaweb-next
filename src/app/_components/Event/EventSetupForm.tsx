'use client'
import EventLocationInput from './EventLocationInput'
import EventPaymentFields from './EventPaymentFields'
import EventRegistrationFields from './EventRegistrationFields'
import EventTagComponent from './EventTag'
import EventVariantsField, { EventVariantsFieldInput, useEventVariantsField } from './EventVariantsField'
import EventWhoCanWhat, { EventQuotaAudiences } from './EventWhoCanWhat'
import { eventSetupFromForm, variantsFromForm } from '@/services/events/setupDraft'
import Form from '@/components/Form/Form'
import FormSection from '@/components/Form/FormSection'
import FormTab from '@/components/Form/FormTab'
import Checkbox from '@/components/UI/Checkbox'
import DateInput from '@/components/UI/DateInput'
import { SelectNumberPossibleNULL, SelectString } from '@/components/UI/Select'
import Slider from '@/components/UI/Slider'
import TextInput from '@/components/UI/TextInput'
import VisibilityMatrixEditor from '@/components/Visibility/VisibilityMatrixEditor/VisibilityMatrixEditor'
import { saveEventSetupAction } from '@/services/events/actions'
import { eventCanBeViewedByOptions } from '@/services/events/constants'
import { eventSetupChecks, setupStatuses } from '@/services/events/publishProblems'
import { nameVariantInErrors } from '@/services/events/setupErrors'
import { useTabs } from '@/components/UI/Tabs'
import { configureAction } from '@/services/configureAction'
import { eventLinks } from '@/pageKits/events/links'
import { useState } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { SetupPart } from '@/services/events/publishProblems'
import type { EventAccess, EventDetailed } from '@/services/events/types'
import type { Committee, Event, EventTag, LedgerAccount } from '@/prisma-generated-pn-types'

/** The tabs of the form, for the Tabs around it. */
export const eventSetupTabs = [
    { key: 'about', label: 'Om arrangementet' },
    { key: 'rules', label: 'Regler' },
    { key: 'registration', label: 'Påmelding' },
    { key: 'payment', label: 'Betaling' },
    { key: 'access', label: 'Hvem kan hva' },
]

/** The tab each part of the setup is put right on, for the dots on the tabs. */
const tabOfPart = {
    time: 'about',
    location: 'about',
    visibility: 'access',
    registration: 'registration',
    payment: 'payment',
    administrators: 'access',
} as const satisfies Record<SetupPart, string>

export type PropTypes = {
    event: Pick<EventDetailed,
        'id' | 'name' | 'location' | 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'hostedByCommitteeId'
        | 'waitingList' | 'bindingRegistration' | 'allowRegistrationInMultipleVariants' | 'updatedAt'
        | 'tags' | 'locationMap' | 'variants' | 'ledgerAccount'
    >,
    access: EventAccess,
    /** Whether the admin visibility could be read, so that the form never saves a fallback over it. */
    adminVisibilityKnown: boolean,
    config: EventPagesConfig,
    eventTags: EventTag[],
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null,
    /** The group accounts the session may link the event to. */
    ledgerAccounts: Pick<LedgerAccount, 'id' | 'name'>[],
}

/**
 * Everything that sets up an event, in one form over the tabs of `eventSetupTabs`. It holds all of
 * it until it is saved, and saves it together, so a change refused anywhere saves nothing. Key it
 * on the event's `updatedAt`, so that it starts over from what was saved. It posts that `updatedAt`
 * with the save, which is refused if the event has been saved since.
 *
 * What it knows of its own values is what it would post. Each value too nested for an input is a
 * field component that holds it and posts it as JSON: the variants, the map and who administrates.
 */
export default function EventSetupForm(props: PropTypes) {
    return <EventVariantsField name="variants" defaultValue={props.event.variants}>
        <SetupForm {...props} />
    </EventVariantsField>
}

function SetupForm({
    event,
    access,
    adminVisibilityKnown,
    config,
    eventTags,
    committees,
    ledgerAccounts,
}: PropTypes) {
    const links = eventLinks(config)
    const lockedTag = config.lockedTag
    // Whether the rules tab has the waiting list switched on, for the registration tab to show it.
    const [waitingList, setWaitingList] = useState(event.waitingList)
    // Who sees and administrates the event as the form has it, for the access tab to show what that gives.
    const [shown, setShown] = useState({
        canBeViewedBy: event.canBeViewedBy,
        adminRequirements: access.adminVisibility.requirements,
    })
    const { variants } = useEventVariantsField()
    const saveSetup: ActionFormData<Event> = configureAction(saveEventSetupAction, { params: { id: event.id } })
    // The schema of the save tells a variant by its place in the list, so the errors are given its name here.
    const save: ActionFormData<Event> = async formData => {
        const result = await saveSetup(formData)
        if (result.success || !result.error) return result
        return { ...result, error: nameVariantInErrors(result.error, variantsFromForm(formData)) }
    }
    const { reportDots } = useTabs()

    const checkSetup = (values: FormData) => {
        const setup = eventSetupFromForm(values, { ...event, adminVisibility: access.adminVisibility })
        reportDots(setupStatuses(eventSetupChecks(setup), tabOfPart))
        setWaitingList(values.getAll('waitingList').includes('on'))
        setShown({ canBeViewedBy: setup.canBeViewedBy, adminRequirements: setup.adminVisibility.requirements })
    }

    return <Form
        action={save}
        submitText="Lagre"
        className="flex flex-col min-h-full"
        saveBar
        onValuesChange={checkSetup}
        refreshOnSuccess
        navigateOnSuccess={data => (data?.name ? links.event(data) : null)}
    >
        <FormTab tab="about">
            <input type="hidden" name="basedOnUpdatedAt" value={event.updatedAt.toISOString()} />
            <FormSection legend="Om arrangementet" columns={2}>
                <TextInput label="Navn" name="name" defaultValue={event.name} />
                <TextInput label="Sted" name="location" defaultValue={event.location ?? ''} />
                <DateInput label="Start" name="eventStart" includeTime defaultValue={event.eventStart} />
                <DateInput label="Slutt" name="eventEnd" includeTime defaultValue={event.eventEnd} />
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
                    defaultValue={event.hostedByCommitteeId ?? 'NULL'}
                />}
            </FormSection>
            <FormSection legend="Kart">
                <EventLocationInput name="locationMap" defaultValue={event.locationMap} />
            </FormSection>
            <FormSection legend="Tagger">
                <ul className="
                    m-0 p-0 flex flex-row flex-wrap gap-x-6 list-none
                    [&_li]:flex [&_li]:items-center [&_li]:z-1
                    [&_li:hover]:z-2
                ">
                    {eventTags.map(tag => {
                        const locked = lockedTag !== null && tag.special === lockedTag
                        return <li key={tag.id}>
                            <Checkbox
                                name="tagIds"
                                value={tag.id}
                                disabled={locked}
                                defaultChecked={locked || event.tags.some(other => other.id === tag.id)}
                            >
                                <EventTagComponent eventTag={tag} />
                            </Checkbox>
                            {/* A disabled checkbox submits nothing, so a hidden field sends the locked tag. */}
                            {locked && <input type="hidden" name="tagIds" value={tag.id} />}
                        </li>
                    })}
                </ul>
            </FormSection>
            <FormSection legend="Varsling">
                <Checkbox name="notifyAboutChange" label="Varsle de påmeldte om endringen" />
                <p className="m-0 text-s text-base-content/80">
                    Endrer du tid eller sted, bør de som er meldt på få beskjed. De får varselet i kanalen for viktig
                    informasjon om arrangementet.
                </p>
            </FormSection>
        </FormTab>

        <FormTab tab="rules">
            <FormSection legend="Påmelding" columns={2}>
                <Slider
                    label="Venteliste"
                    name="waitingList"
                    defaultChecked={event.waitingList}
                />
                <Slider
                    label="Bindende påmelding"
                    name="bindingRegistration"
                    defaultChecked={event.bindingRegistration}
                />
                <Slider
                    label="Plass i flere varianter"
                    name="allowRegistrationInMultipleVariants"
                    defaultChecked={event.allowRegistrationInMultipleVariants}
                />
            </FormSection>
        </FormTab>

        <FormTab tab="registration">
            <EventVariantsFieldInput />
            <EventRegistrationFields waitingList={waitingList} eventStart={event.eventStart} />
        </FormTab>

        <FormTab tab="payment">
            <EventPaymentFields ledgerAccount={event.ledgerAccount} ledgerAccounts={ledgerAccounts} />
        </FormTab>

        <FormTab tab="access">
            <FormSection legend="Hvem kan se arrangementet">
                <SelectString
                    className="max-w-[300px]"
                    label="Hvem kan se arrangementet"
                    name="canBeViewedBy"
                    options={eventCanBeViewedByOptions}
                    defaultValue={event.canBeViewedBy}
                />
            </FormSection>
            <div className="flex flex-col gap-2 pb-4">
                <p className="m-0 font-medium">Hvem kan melde seg på</p>
                <EventQuotaAudiences variants={variants} />
            </div>
            {adminVisibilityKnown ? <div className="flex flex-col gap-3 pb-4">
                <p className="m-0 font-medium">Hvem kan administrere arrangementet</p>
                <p className="m-0 text-s text-base-content/80">
                    Uten grupper kan bare de med rettigheten EVENT_ADMIN administrere arrangementet.
                </p>
                <VisibilityMatrixEditor
                    name="adminRequirements"
                    defaultValue={access.adminVisibility.requirements}
                    verb="kan administrere arrangementet"
                />
            </div> : <p className="m-0 text-base-content/80">Du kan ikke se hvem som administrerer arrangementet.</p>}
            {adminVisibilityKnown && <>
                <p className="m-0 font-medium">Slik blir det</p>
                <EventWhoCanWhat access={{
                    ...access,
                    canBeViewedBy: shown.canBeViewedBy,
                    // The save refuses an empty editor, so until then no one is shown as administrating.
                    adminVisibility: {
                        requirements: shown.adminRequirements.length > 0 ? shown.adminRequirements : [{ conditions: [] }],
                    },
                    quotaVisibilities: variants.flatMap(variant => variant.quotas.map(quota => ({
                        requirements: quota.visibilityRequirements,
                    }))),
                }} />
            </>}
        </FormTab>
    </Form>
}
