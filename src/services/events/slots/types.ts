import type { slotScheduleSelection } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type SlotSchedule = Prisma.EventSlotScheduleGetPayload<{ select: typeof slotScheduleSelection }>

/** A schedule as the setup form holds it, with a start that may have been emptied. */
export type SlotScheduleDraft = Omit<SlotSchedule, 'start'> & { start: Date | null }

export type Slot = { start: Date, end: Date }

/** A slot as a variant offers it, which is free while no registration holds it. */
export type SlotOfVariant = Slot & { id: number, free: boolean }

/** A slot as its variant's administrators see it, with who holds it. */
/** The slots of a variant with who holds each, and who waits for one, as `readBoard` gives them. */
export type SlotBoard = { slots: SlotOnBoard[], waiting: number[] }

export type SlotOnBoard = Slot & {
    id: number,
    /** Who holds the slot, and whether they have paid for their place, which a placing does not take back. */
    holder: { registrationId: number, name: string, paid: boolean } | null,
}

/**
 * What a change of the slots did to a registration that held one or was removed: the slot it held
 * and the one it holds now, which is none on the waiting list.
 */
export type SlotChange = {
    registrationId: number,
    variantId: number,
    userId: number | null,
    contact: { email: string | null } | null,
    before: Slot | null,
    after: Slot | null,
    removed: boolean,
}
