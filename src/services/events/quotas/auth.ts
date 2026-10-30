import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'

/**
 * The quotas of an event are part of administrating it, so changing them takes the event's admin
 * visibility. Reading them takes seeing the event. Both need `EventAccess` supplied via `.data()`.
 */
export const eventQuotaAuth = {
    readMany: canSeeEvent,
    create: eventAdminLevel,
    update: eventAdminLevel,
    destroy: eventAdminLevel,
    reorder: eventAdminLevel,

    readVisibility: canSeeEvent,
    updateVisibility: eventAdminLevel,
} as const
