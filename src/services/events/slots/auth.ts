import { canSeeEvent, eventAdminLevel } from '@/services/events/auth'

export const eventSlotAuth = {
    // Whether a slot is free tells no one who holds it.
    readOfVariant: canSeeEvent,
    readBoard: eventAdminLevel,
} as const
