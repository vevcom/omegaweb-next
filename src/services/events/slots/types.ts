import type { slotScheduleSelection } from './constants'
import type { ClassLevel, Prisma } from '@/prisma-generated-pn-types'

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

/** Who holds a slot as the company of the event sees them. A guest has no class or study programme. */
export type SlotHolderForCompany = {
    name: string,
    email: string | null,
    class: ClassLevel | null,
    studyProgrammes: string[],
}

/** A slotted variant as the company of its event sees it: the slots in order with who holds each, and how many wait. */
export type CompanySchedule = {
    slots: (Slot & { id: number, holder: SlotHolderForCompany | null })[],
    waiting: number,
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
