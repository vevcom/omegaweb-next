'use client'
import EventPublishing from './EventPublishing'
import EventSetupForm, { eventSetupTabs } from './EventSetupForm'
import EventStatistics from './EventStatistics'
import ManualRegistrationForm from './ManualRegistrationForm'
import Tabs, { TabPanel } from '@/components/UI/Tabs'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { VariantStatistics } from '@/services/events/statistics'

type SetupProps = ComponentProps<typeof EventSetupForm>
type PropTypes = Omit<SetupProps, 'event' | 'onDiscard'> & {
    event: SetupProps['event'] & ComponentProps<typeof EventPublishing>['event'] & { takesRegistration: boolean },
    capabilities: CapabilitiesJsObject<'canUpdate' | 'canDestroy' | 'canRegisterAsAdmin' | 'canRegisterGuest'>,
    /** Null when the event takes no registration, or they could not be read. */
    statistics: VariantStatistics[] | null,
}

/**
 * Everything those who administrate an event can do with it, on one set of tabs. Setting it up is
 * one form over several tabs. Registering others, publishing and deleting are done on the spot, next to the statistics.
 */
export default function EventAdmin({ event, capabilities, statistics, ...setup }: PropTypes) {
    const canUpdate = capabilities.canUpdate.authorized
    const canRegisterOthers = capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized
    const showRegisterOthers = event.takesRegistration && canRegisterOthers
    const showPublishing = canUpdate || capabilities.canDestroy.authorized
    const [discards, setDiscards] = useState(0)

    return <div className="min-w-[min(90vw,62rem)] h-[min(85svh,44rem)]">
        <Tabs
            label="Administrer arrangementet"
            tabs={[
                ...(canUpdate ? eventSetupTabs : []),
                ...(showRegisterOthers ? [{ key: 'others', label: 'Meld på andre' }] : []),
                ...(statistics ? [{ key: 'statistics', label: 'Statistikk' }] : []),
                ...(showPublishing ? [{ key: 'publishing', label: 'Publisering' }] : []),
            ]}
        >
            {canUpdate && <TabPanel tab={eventSetupTabs.map(tab => tab.key)}>
                <EventSetupForm
                    key={JSON.stringify([event.variants, setup.access.adminVisibility, discards])}
                    event={event}
                    {...setup}
                    onDiscard={() => setDiscards(discards + 1)}
                />
            </TabPanel>}

            {showRegisterOthers && <TabPanel tab="others">
                <ManualRegistrationForm
                    eventId={event.id}
                    variants={event.variants}
                    capabilities={{
                        canRegisterAsAdmin: capabilities.canRegisterAsAdmin,
                        canRegisterGuest: capabilities.canRegisterGuest,
                    }}
                />
            </TabPanel>}

            {statistics && <TabPanel tab="statistics">
                <EventStatistics variants={statistics} />
            </TabPanel>}

            {showPublishing && <TabPanel tab="publishing">
                <EventPublishing
                    event={event}
                    access={setup.access}
                    config={setup.config}
                    capabilities={{ canDestroy: capabilities.canDestroy }}
                />
            </TabPanel>}
        </Tabs>
    </div>
}
