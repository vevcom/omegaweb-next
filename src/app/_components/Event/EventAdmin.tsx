'use client'
import EventPublishing from './EventPublishing'
import EventSeating from './EventSeating'
import EventSetupForm, { eventSetupTabs } from './EventSetupForm'
import EventStatistics from './EventStatistics'
import ManualRegistrationForm from './ManualRegistrationForm'
import Tabs, { TabPanel } from '@/components/UI/Tabs'
import { publishProblems } from '@/services/events/publishProblems'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { SeatingBoard } from '@/services/events/seating/types'
import type { VariantStatistics } from '@/services/events/statistics'

type SetupProps = ComponentProps<typeof EventSetupForm>
type PropTypes = Omit<SetupProps, 'event' | 'onDiscard'> & {
    event: SetupProps['event'] & ComponentProps<typeof EventPublishing>['event'] & { takesRegistration: boolean },
    capabilities: CapabilitiesJsObject<'canUpdate' | 'canDestroy' | 'canRegisterAsAdmin' | 'canRegisterGuest'>,
    /** Null when the event takes no registration, or they could not be read. */
    statistics: VariantStatistics[] | null,
    /** Null when the event takes no registration, or they could not be read. */
    seatingBoard: SeatingBoard | null,
}

/**
 * Everything those who administrate an event can do with it, on one set of tabs. Setting it up is
 * one form over several tabs. Registering others, publishing and deleting are done on the spot, next to the statistics.
 */
export default function EventAdmin({ event, capabilities, statistics, seatingBoard, ...setup }: PropTypes) {
    const canUpdate = capabilities.canUpdate.authorized
    const canRegisterOthers = capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized
    const showRegisterOthers = event.takesRegistration && canRegisterOthers
    const showPublishing = canUpdate || capabilities.canDestroy.authorized
    const [discards, setDiscards] = useState(0)
    // Registering someone changes the counts, which must not throw away what is being set up.
    const setupFormKey = JSON.stringify(
        [event.variants, setup.access.adminVisibility, discards],
        (key, value: unknown) => (['numOfRegistrations', 'numOnWaitingList'].includes(key) ? undefined : value),
    )
    const publishingDot = () => {
        if (event.published) return { level: 'ok' as const, label: 'Publisert' }
        return publishProblems({ ...event, adminVisibility: setup.access.adminVisibility }).length > 0
            ? { level: 'missing' as const, label: 'Noe mangler før det kan publiseres' }
            : { level: 'warning' as const, label: 'Klart, men ikke publisert' }
    }

    return <div className="min-w-[min(90vw,62rem)] h-[min(85svh,44rem)]">
        <Tabs
            label="Administrer arrangementet"
            tabs={[
                ...(canUpdate ? eventSetupTabs : []),
                ...(showRegisterOthers ? [{ key: 'others', label: 'Meld på andre' }] : []),
                ...(statistics ? [{ key: 'statistics', label: 'Statistikk' }] : []),
                ...(seatingBoard ? [{ key: 'seating', label: 'Bordplassering' }] : []),
                ...(showPublishing ? [{ key: 'publishing', label: 'Publisering', dot: publishingDot() }] : []),
            ]}
        >
            {canUpdate && <TabPanel tab={eventSetupTabs.map(tab => tab.key)}>
                <EventSetupForm
                    key={setupFormKey}
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

            {seatingBoard && <TabPanel tab="seating">
                <EventSeating eventId={event.id} board={seatingBoard} />
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
