'use client'
import ConnectEventToLedgerForm from './ConnectEventToLedgerForm'
import EventLocationInput from './EventLocationInput'
import EventPublishing from './EventPublishing'
import EventTagComponent from './EventTag'
import EventVariantsAdmin from './EventVariantsAdmin'
import EventVisibilityAdmin from './EventVisibilityAdmin'
import ManualRegistrationForm from './ManualRegistrationForm'
import Form from '@/components/Form/Form'
import FormSection from '@/components/Form/FormSection'
import FormTab from '@/components/Form/FormTab'
import Checkbox from '@/components/UI/Checkbox'
import DateInput from '@/components/UI/DateInput'
import { SelectNumberPossibleNULL, SelectString } from '@/components/UI/Select'
import Slider from '@/components/UI/Slider'
import Tabs, { TabPanel } from '@/components/UI/Tabs'
import TextInput from '@/components/UI/TextInput'
import { updateEventAction } from '@/services/events/actions'
import { eventCanBeViewedByOptions } from '@/services/events/constants'
import { configureAction } from '@/services/configureAction'
import { eventLinks } from '@/pageKits/events/links'
import type { ComponentProps } from 'react'
import type { ActionFormData } from '@/services/actionTypes'
import type { Tab } from '@/components/UI/Tabs'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { EventAccess } from '@/services/events/types'
import type { Committee, Event, EventLocationMap, EventTag } from '@/prisma-generated-pn-types'

type PropTypes = {
    event: Pick<Event,
        'id' | 'name' | 'location' | 'eventStart' | 'eventEnd' | 'canBeViewedBy' | 'hostedByCommitteeId'
        | 'waitingList' | 'bindingRegistration' | 'allowRegistrationInMultipleVariants' | 'published'
        | 'visibilityAdminId'
    > & {
        tags: EventTag[],
        locationMap: EventLocationMap | null,
        takesPayment: boolean,
        takesRegistration: boolean,
        variants: ComponentProps<typeof EventVariantsAdmin>['variants'],
        ledgerAccount: ComponentProps<typeof ConnectEventToLedgerForm>['ledgerAccount'],
    },
    access: EventAccess,
    /** Whether the admin visibility could be read, so that the editor never saves a fallback over it. */
    adminVisibilityKnown: boolean,
    config: EventPagesConfig,
    eventTags: EventTag[],
    /** The committees to choose the host from, or null when they could not be read (they take COMMITTEE_USE). */
    committees: Committee[] | null,
    ledgerAccounts: ComponentProps<typeof ConnectEventToLedgerForm>['ledgerAccounts'],
    capabilities: CapabilitiesJsObject<
        'canUpdate' | 'canUpdateVisibility' | 'canUpdateVariants' | 'canDestroy'
        | 'canRegisterAsAdmin' | 'canRegisterGuest'
    >,
}

/**
 * Everything those who administrate an event can set up, on one set of tabs. The event's own
 * fields share one form across their tabs. Variants, access and registering others still save on
 * their own, since they are forms of their own.
 */
export default function EventAdmin({
    event,
    access,
    adminVisibilityKnown,
    config,
    eventTags,
    committees,
    ledgerAccounts,
    capabilities,
}: PropTypes) {
    const links = eventLinks(config)
    const lockedTag = config.lockedTag
    const save: ActionFormData<Event> = configureAction(updateEventAction, { params: { id: event.id } })
    const canRegisterOthers = capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized

    const tabs: (Tab | false)[] = [
        capabilities.canUpdate.authorized && { key: 'about', label: 'Om arrangementet' },
        capabilities.canUpdate.authorized && { key: 'rules', label: 'Regler' },
        capabilities.canUpdateVariants.authorized && { key: 'registration', label: 'Påmelding' },
        event.takesPayment && capabilities.canUpdate.authorized && { key: 'payment', label: 'Betaling' },
        capabilities.canUpdateVisibility.authorized && { key: 'access', label: 'Tilgang' },
        event.takesRegistration && canRegisterOthers && { key: 'others', label: 'Meld på andre' },
        (capabilities.canUpdateVisibility.authorized || capabilities.canDestroy.authorized)
            && { key: 'publishing', label: 'Publisering' },
    ]

    return <div className="min-w-[min(90vw,62rem)]">
        <Tabs tabs={tabs.filter(tab => tab !== false)} label="Administrer arrangementet">
            {capabilities.canUpdate.authorized && <TabPanel tab={['about', 'rules']}>
                <Form
                    action={save}
                    submitText="Lagre"
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
                            <p className="m-0 text-s text-text-muted">
                                Endrer du tid eller sted, bør de som er meldt på få beskjed. De får varselet i kanalen
                                for viktig informasjon om arrangementet.
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
                            <Slider label="Venteliste" name="waitingList" defaultChecked={event.waitingList} />
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
                </Form>
            </TabPanel>}

            {capabilities.canUpdateVariants.authorized && <TabPanel tab="registration">
                <EventVariantsAdmin eventId={event.id} variants={event.variants} />
            </TabPanel>}

            {event.takesPayment && capabilities.canUpdate.authorized && <TabPanel tab="payment">
                <ConnectEventToLedgerForm
                    eventId={event.id}
                    ledgerAccount={event.ledgerAccount}
                    ledgerAccounts={ledgerAccounts}
                />
            </TabPanel>}

            {capabilities.canUpdateVisibility.authorized && <TabPanel tab="access">
                <EventVisibilityAdmin event={event} access={access} adminVisibilityKnown={adminVisibilityKnown} />
            </TabPanel>}

            {event.takesRegistration && canRegisterOthers && <TabPanel tab="others">
                <ManualRegistrationForm
                    eventId={event.id}
                    variants={event.variants}
                    capabilities={{
                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin,
                        canRegisterGuest: capabilities.canRegisterGuest,
                    }}
                />
            </TabPanel>}

            {(capabilities.canUpdateVisibility.authorized || capabilities.canDestroy.authorized)
                && <TabPanel tab="publishing">
                    <EventPublishing
                        event={event}
                        access={access}
                        config={config}
                        capabilities={{ canDestroy: capabilities.canDestroy }}
                    />
                </TabPanel>}
        </Tabs>
    </div>
}
