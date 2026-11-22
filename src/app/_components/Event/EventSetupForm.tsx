'use client'
import { EventAccessOfSessions, EventQuotaVisibilities, EventSeenBy } from './EventAccessOverview'
import EventLocationInput from './EventLocationInput'
import { eventAdminVisibility } from './eventVisibility'
import EventPaymentFields from './EventPaymentFields'
import EventRegistrationFields from './EventRegistrationFields'
import EventTagComponent from './EventTag'
import EventVariantsField, { EventVariantsFieldInput, useEventVariantsField } from './EventVariantsField'
import LinkedEventField, { LinkedEventSelectionProvider, useLinkedEvent } from './LinkedEventField'
import SelectedCompany from '@/components/Company/SelectedCompany'
import CompanySelectionProvider, { CompanySelectionContext } from '@/contexts/CompanySelection'
import PopUpProvider from '@/contexts/PopUp'
import { eventSetupFromForm, slotsToPlaceIn, variantsFromForm } from '@/services/events/setupDraft'
import Form from '@/components/Form/Form'
import FormSection from '@/components/Form/FormSection'
import FormTab from '@/components/Form/FormTab'
import Checkbox from '@/components/UI/Checkbox'
import DateInput from '@/components/UI/DateInput'
import { SelectNumberPossibleNULL, SelectString } from '@/components/UI/Select'
import Slider from '@/components/UI/Slider'
import TextInput from '@/components/UI/TextInput'
import { saveEventSetupAction } from '@/services/events/actions'
import { eventCanBeViewedByOptions } from '@/services/events/constants'
import { eventSetupChecks, setupStatuses } from '@/services/events/publishProblems'
import { firstVariantSetup, slotsStartOf } from '@/services/events/firstSetup'
import { eventKinds } from '@/services/events/kinds'
import { nameVariantInErrors } from '@/services/events/setupErrors'
import { useTabs } from '@/components/UI/Tabs'
import { configureAction } from '@/services/configureAction'
import { eventLinks } from '@/pageKits/events/links'
import { companyAuth } from '@/services/careers/companies/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useContext, useState } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { SetupPart } from '@/services/events/publishProblems'
import type { EventAccess, EventDetailed, LinkableEvent } from '@/services/events/types'
import type { SlotOnBoard } from '@/services/events/slots/types'
import type { Committee, Event, EventTag, LedgerAccount } from '@/prisma-generated-pn-types'

/** What the save gives back, which is enough to go to the event's page. */
type SavedEvent = Pick<Event, 'id' | 'kind' | 'name'>

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
        'id' | 'kind' | 'name' | 'location' | 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'hostedByCommitteeId'
        | 'waitingList' | 'bindingRegistration' | 'allowRegistrationInMultipleVariants' | 'updatedAt'
        | 'tags' | 'locationMap' | 'variants' | 'ledgerAccount' | 'company' | 'companyPresentation'
        | 'requiresPresentationSeat'
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
    /** The slots of each slotted variant by its id, with who holds them, for placing them in new ones. */
    savedSlots: Record<number, SlotOnBoard[]>,
    /** Who waits on each slotted variant by its id, which with the holders are all that removing everyone removes. */
    savedWaiting: Record<number, number[]>,
    /** The events the event may be linked to, when its kind links to another. */
    linkable: LinkableEvent[],
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
    // The form is in a pop-up itself, which a pop-up opened from the app's provider would replace, so
    // the company and the linked event are chosen in a provider of its own. It renders those pop-ups
    // before the form rather than in it, where their buttons and Enter would submit the form.
    return <EventVariantsField
        name="variants"
        defaultValue={props.event.variants}
        savedSlots={props.savedSlots}
        savedWaiting={props.savedWaiting}
    >
        <CompanySelectionProvider company={props.event.company}>
            <LinkedEventSelectionProvider linked={props.event.companyPresentation}>
                <PopUpProvider>
                    <SetupForm {...props} />
                </PopUpProvider>
            </LinkedEventSelectionProvider>
        </CompanySelectionProvider>
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
    linkable,
}: PropTypes) {
    const links = eventLinks(config)
    const linksTo = eventKinds[event.kind].linksTo
    // Whether the rules tab has the waiting list switched on, for the registration tab to show it.
    const [waitingList, setWaitingList] = useState(event.waitingList)
    // Who sees and administrates the event as the form has it, for the access tab to show what that gives.
    const [shown, setShown] = useState({
        canBeViewedBy: event.canBeViewedBy,
        adminRequirements: access.adminVisibility.requirements,
    })
    // The time as the form has it, so a first variant gets what the kind gives it from the start just set.
    const [time, setTime] = useState({ eventStart: event.eventStart, eventEnd: event.eventEnd })
    const { variants } = useEventVariantsField()
    const companySelection = useContext(CompanySelectionContext)
    const shownAccess = {
        ...access,
        canBeViewedBy: shown.canBeViewedBy,
        companyId: companySelection?.selectedCompany?.id ?? null,
        // The save refuses an empty editor, so until then no one is shown as administrating.
        adminVisibility: {
            requirements: shown.adminRequirements.length > 0 ? shown.adminRequirements : [{ conditions: [] }],
        },
        quotaVisibilities: variants.flatMap(variant => variant.quotas.map(quota => ({
            requirements: quota.visibilityRequirements,
        }))),
    }
    const saveSetup: ActionFormData<SavedEvent> = configureAction(saveEventSetupAction, { params: { id: event.id } })
    // The schema of the save tells a variant by its place in the list, so the errors are given its name here.
    const save: ActionFormData<SavedEvent> = async formData => {
        const result = await saveSetup(formData)
        if (result.success || !result.error) return result
        return { ...result, error: nameVariantInErrors(result.error, variantsFromForm(formData)) }
    }
    const { reportDots } = useTabs()
    const removingEveryone = variants.filter(variant => variant.slotPlacing.removeEveryone && slotsToPlaceIn(variant))
    const removedCount = removingEveryone.reduce(
        (sum, variant) => sum + variant.numOfRegistrations + variant.numOnWaitingList,
        0,
    )
    // Putting a company on the event takes COMPANY_USE, as reading the companies to choose from does.
    // Without it the company is kept or cleared.
    const canChooseCompany = useAuthorizer({ authorizer: companyAuth.readPage }).authorized

    const checkSetup = (values: FormData) => {
        const setup = eventSetupFromForm(values, { ...event, adminVisibility: access.adminVisibility })
        reportDots(setupStatuses(eventSetupChecks(setup), tabOfPart))
        setWaitingList(values.getAll('waitingList').includes('on'))
        setShown({ canBeViewedBy: setup.canBeViewedBy, adminRequirements: setup.adminVisibility.requirements })
        setTime({ eventStart: setup.eventStart, eventEnd: setup.eventEnd })
    }

    return <Form
        action={save}
        submitText="Lagre"
        className="flex flex-col min-h-full"
        saveBar
        confirmation={removingEveryone.length > 0 ? {
            confirm: true,
            text: `Lagringen melder av alle de ${removedCount} påmeldte til `
                + `${removingEveryone.map(variant => variant.name).join(' og ')}, også de på ventelisten, `
                + 'og gir tilbake det de har betalt.',
        } : undefined}
        onValuesChange={checkSetup}
        refreshOnSuccess
        navigateOnSuccess={data => links.event(data)}
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
            <FormSection legend="Bedrift">
                <SelectedCompany optional chooseInPopUp={canChooseCompany} />
            </FormSection>
            {linksTo && <FormSection legend="Hører til">
                <LinkedEventField name={eventKinds[linksTo].name} linkable={linkable} />
                <PresentationSeatSwitch defaultChecked={event.requiresPresentationSeat} />
            </FormSection>}
            <FormSection legend="Kart">
                <EventLocationInput name="locationMap" defaultValue={event.locationMap} />
            </FormSection>
            <FormSection legend="Tagger">
                <ul className="
                    m-0 p-0 flex flex-row flex-wrap gap-x-6 list-none
                    [&_li]:flex [&_li]:items-center [&_li]:z-1
                    [&_li:hover]:z-2
                ">
                    {eventTags.map(tag => <li key={tag.id}>
                        <Checkbox
                            name="tagIds"
                            value={tag.id}
                            defaultChecked={event.tags.some(other => other.id === tag.id)}
                        >
                            <EventTagComponent eventTag={tag} />
                        </Checkbox>
                    </li>)}
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
            <EventRegistrationFields
                waitingList={waitingList}
                eventStart={event.eventStart}
                slotsStart={slotsStartOf(time)}
                firstVariant={firstVariantSetup(event.kind, time)}
            />
        </FormTab>

        <FormTab tab="payment">
            <EventPaymentFields ledgerAccount={event.ledgerAccount} ledgerAccounts={ledgerAccounts} />
        </FormTab>

        <FormTab tab="access">
            <FormSection legend="Hvem kan se arrangementet">
                <SelectString
                    className="max-w-[300px]"
                    label="Synlig for"
                    name="canBeViewedBy"
                    options={eventCanBeViewedByOptions}
                    defaultValue={event.canBeViewedBy}
                />
                {adminVisibilityKnown && <EventSeenBy access={shownAccess} />}
            </FormSection>
            <div className="flex flex-col gap-2 pb-4">
                <p className="m-0 font-medium">Hvem kan melde seg på</p>
                <EventQuotaVisibilities variants={variants} />
            </div>
            {adminVisibilityKnown ? <div className="flex flex-col gap-3 pb-4">
                <p className="m-0 font-medium">Hvem kan administrere arrangementet</p>
                <p className="m-0 text-s text-base-content/80">
                    Uten grupper kan bare de med rettigheten EVENT_ADMIN administrere arrangementet.
                </p>
                <eventAdminVisibility.Field
                    name="adminRequirements"
                    defaultValue={access.adminVisibility.requirements}
                />
            </div> : <p className="m-0 text-base-content/80">Du kan ikke se hvem som administrerer arrangementet.</p>}
            {adminVisibilityKnown && <div className="flex flex-col gap-2 pb-4">
                <p className="m-0 font-medium">Slik blir det</p>
                <EventAccessOfSessions access={shownAccess} />
            </div>}
        </FormTab>
    </Form>
}

/** The requirement is read only while the event is linked, so it is offered only while a presentation is picked. */
function PresentationSeatSwitch({ defaultChecked }: { defaultChecked: boolean }) {
    return useLinkedEvent() && <Slider
        label="Påmelding krever plass på presentasjonen"
        name="requiresPresentationSeat"
        defaultChecked={defaultChecked}
    />
}
