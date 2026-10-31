import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'

/** The quotas of an event are administrated with it. Both need `EventAccess` via `.data()`. */
export const eventQuotaAuth = {
    readMany: canSeeEvent,
    create: eventAdminLevel,
    update: eventAdminLevel,
    destroy: eventAdminLevel,
    reorder: eventAdminLevel,

    readVisibility: canSeeEvent,
    updateVisibility: eventAdminLevel,
} as const
