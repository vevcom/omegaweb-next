'use client'
import EventLocationInput from './EventLocationInput'
import EventPaymentFields from './EventPaymentFields'
import EventRegistrationFields from './EventRegistrationFields'
import EventTagComponent from './EventTag'
import { toVariantDrafts } from './eventSetupDraft'
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
import { eventSetupChecks, setupTabStatuses } from '@/services/events/publishProblems'
import { useTabs } from '@/components/UI/Tabs'
import { configureAction } from '@/services/configureAction'
import { eventLinks } from '@/pageKits/events/links'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { VariantDraft } from './eventSetupDraft'
import type { ActionFormData } from '@/services/actionTypes'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { EventVariantExpanded } from '@/services/events/variants/types'
import type { EventAccess } from '@/services/events/types'
import type { Committee, Event, EventCanView, EventLocationMap, EventTag } from '@/prisma-generated-pn-types'

/** DateInput submits UTC without saying so, which Date would read as local time. */
const utcDate = (value: FormDataEntryValue | null) => new Date(`${value as string}Z`)

/** The tabs of the form, for the Tabs around it. */
export const eventSetupTabs = [
    { key: 'about', label: 'Om arrangementet' },
    { key: 'rules', label: 'Regler' },
    { key: 'registration', label: 'Påmelding' },
    { key: 'payment', label: 'Betaling' },
    { key: 'access', label: 'Tilgang' },
]

type PropTypes = {
    event: Pick<Event,
        'id' | 'name' | 'location' | 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'hostedByCommitteeId'
        | 'waitingList' | 'bindingRegistration' | 'allowRegistrationInMultipleVariants'
    > & {
        tags: EventTag[],
        locationMap: EventLocationMap | null,
        variants: EventVariantExpanded[],
        ledgerAccount: ComponentProps<typeof EventPaymentFields>['ledgerAccount'],
    },
    access: EventAccess,
    /** Whether the admin visibility could be read, so that the form never saves a fallback over it. */
    adminVisibilityKnown: boolean,
    config: EventPagesConfig,
    eventTags: EventTag[],
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null,
    ledgerAccounts: ComponentProps<typeof EventPaymentFields>['ledgerAccounts'],
    onDiscard: () => void,
}

/**
 * Everything that sets up an event, in one form over the tabs of `eventSetupTabs`. It holds all of
 * it until it is saved, and saves it together, so a change refused anywhere saves nothing. Remount
 * it with a key of what the server holds, so that a save replaces what it holds with the result.
 */
export default function EventSetupForm({
    event,
    access,
    adminVisibilityKnown,
    config,
    eventTags,
    committees,
    ledgerAccounts,
    onDiscard,
}: PropTypes) {
    const links = eventLinks(config)
    const lockedTag = config.lockedTag
    const [variants, setVariants] = useState<VariantDraft[]>(() => toVariantDrafts(event.variants))
    const [adminRequirements, setAdminRequirements] = useState(access.adminVisibility.requirements)
    const [waitingList, setWaitingList] = useState(event.waitingList)
    const save: ActionFormData<Event> = configureAction(saveEventSetupAction, { params: { id: event.id } })
    const { reportDots } = useTabs()

    const checkSetup = (values: FormData) => {
        const account = values.get('ledgerAccountSelection')
        reportDots(setupTabStatuses(eventSetupChecks({
            location: values.get('location') as string | null,
            eventStart: utcDate(values.get('eventStart')),
            eventEnd: utcDate(values.get('eventEnd')),
            canBeViewedBy: (values.get('canBeViewedBy') ?? event.canBeViewedBy) as EventCanView,
            // An account left unpicked keeps the one the event has, as the save does.
            ledgerAccount: event.ledgerAccount ?? (account && account !== 'NULL' ? { id: Number(account) } : null),
            variants,
            adminVisibility: { requirements: adminRequirements },
        })))
    }

    return <Form
        action={save}
        submitText="Lagre"
        className="flex flex-col min-h-full"
        saveBar={{ onDiscard }}
        onValuesChange={checkSetup}
        refreshOnSuccess
        navigateOnSuccess={data => (data?.name ? links.event(data) : null)}
    >
        <FormTab tab="about">
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
            <FormSection legend="Synlighet">
                <SelectString
                    className="max-w-[300px]"
                    label="Hvem kan se arrangementet"
                    name="canBeViewedBy"
                    options={eventCanBeViewedByOptions}
                    defaultValue={event.canBeViewedBy}
                />
            </FormSection>
            <FormSection legend="Påmelding" columns={2}>
                <Slider
                    label="Venteliste"
                    name="waitingList"
                    checked={waitingList}
                    onChange={changeEvent => setWaitingList(changeEvent.target.checked)}
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
            <input type="hidden" name="variants" value={JSON.stringify(variants)} />
            <EventRegistrationFields
                variants={variants}
                waitingList={waitingList}
                eventStart={event.eventStart}
                onChange={setVariants}
            />
        </FormTab>

        <FormTab tab="payment">
            <EventPaymentFields
                variants={variants}
                ledgerAccount={event.ledgerAccount}
                ledgerAccounts={ledgerAccounts}
                onChange={(key, changes) => setVariants(variants.map(variant => (
                    variant.key === key ? { ...variant, ...changes } : variant
                )))}
            />
        </FormTab>

        <FormTab tab="access">
            {adminVisibilityKnown ? <div className="flex flex-col gap-3 pb-4">
                <p className="m-0 font-medium">Hvem kan administrere arrangementet</p>
                <p className="m-0 text-s text-base-content/80">
                    Uten krav kan bare de med rettigheten EVENT_ADMIN administrere arrangementet.
                </p>
                <input type="hidden" name="adminRequirements" value={JSON.stringify(adminRequirements)} />
                <VisibilityMatrixEditor requirements={adminRequirements} onChange={setAdminRequirements} />
            </div> : <p className="m-0 text-base-content/80">Du kan ikke se hvem som administrerer arrangementet.</p>}
        </FormTab>
    </Form>
}
