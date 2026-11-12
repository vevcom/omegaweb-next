'use client'
import EventNotificationsAdmin from './EventNotificationsAdmin'
import EventPublishing from './EventPublishing'
import EventSetupForm, { eventSetupTabs } from './EventSetupForm'
import EventStatistics from './EventStatistics'
import ManualRegistrationForm from './ManualRegistrationForm'
import Tabs, { TabPanel } from '@/components/UI/Tabs'
import { publishProblems } from '@/services/events/publishProblems'
import type { PropTypes as SetupFormPropTypes } from './EventSetupForm'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'
import type { VariantStatistics } from '@/services/events/statistics'
import type { EventDetailed } from '@/services/events/types'
import type { AppHref } from '@/lib/sites/href'

type PropTypes = Omit<SetupFormPropTypes, 'event'> & {
    event: EventDetailed,
    eventHref: AppHref,
    capabilities: CapabilitiesJsObject<
        'canUpdate' | 'canSetPublished' | 'canDestroy' | 'canRegisterAsAdmin' | 'canRegisterGuest'
        | 'canCreateNotification'
    >,
    /** Null when the event takes no registration, or they could not be read. */
    statistics: VariantStatistics[] | null,
}

/**
 * Everything those who administrate an event can do with it, on one set of tabs. Setting it up is
 * one form over several tabs. Registering others, publishing and deleting are done on the spot, next to the statistics.
 */
export default function EventAdmin({ event, eventHref, capabilities, statistics, ...setup }: PropTypes) {
    const canUpdate = capabilities.canUpdate.authorized
    const canRegisterOthers = capabilities.canRegisterAsAdmin.authorized || capabilities.canRegisterGuest.authorized
    const showRegisterOthers = event.takesRegistration && canRegisterOthers
    const showPublishing = capabilities.canSetPublished.authorized || capabilities.canDestroy.authorized
    const canNotify = capabilities.canCreateNotification.authorized
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
                ...(canNotify ? [{ key: 'notifications', label: 'Varsle' }] : []),
                ...(showPublishing ? [{ key: 'publishing', label: 'Publisering', dot: publishingDot() }] : []),
            ]}
        >
            {canUpdate && <TabPanel tab={eventSetupTabs.map(tab => tab.key)}>
                {/*
                  * A save moves `updatedAt`, so the form starts over from what was saved. Someone
                  * registering does not, so that never throws away what is being set up.
                  */}
                <EventSetupForm key={event.updatedAt.getTime()} event={event} {...setup} />
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
                <EventStatistics variants={statistics} eventStart={event.eventStart} />
            </TabPanel>}

            {canNotify && <TabPanel tab="notifications">
                <EventNotificationsAdmin event={event} eventHref={eventHref} />
            </TabPanel>}

            {showPublishing && <TabPanel tab="publishing">
                <EventPublishing
                    event={event}
                    adminVisibility={setup.access.adminVisibility}
                    config={setup.config}
                    capabilities={{
                        canSetPublished: capabilities.canSetPublished,
                        canDestroy: capabilities.canDestroy,
                    }}
                />
            </TabPanel>}
        </Tabs>
    </div>
}
