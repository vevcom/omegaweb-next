import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'

/** The variants of an event are administrated with it. Both need `EventAccess` via `.data()`. */
export const eventVariantAuth = {
    readMany: canSeeEvent,
    create: eventAdminLevel,
    update: eventAdminLevel,
    destroy: eventAdminLevel,
    reorder: eventAdminLevel,
} as const
