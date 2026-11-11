import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'

/**
 * The quotas of an event are administrated with it, and changed by saving the event's setup. Both
 * need `EventAccess` via `.data()`.
 */
export const eventQuotaAuth = {
    readMany: canSeeEvent,

    readVisibility: canSeeEvent,
    updateVisibility: eventAdminLevel,
} as const
