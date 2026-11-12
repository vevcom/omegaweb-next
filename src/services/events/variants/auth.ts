import { canSeeEvent } from '@/services/events/auth'

/**
 * The variants of an event are administrated with it, and changed by saving the event's setup.
 * Needs `EventAccess` via `.data()`.
 */
export const eventVariantAuth = {
    readMany: canSeeEvent,
} as const
