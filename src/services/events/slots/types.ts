import type { slotScheduleSelection } from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type SlotSchedule = Prisma.EventSlotScheduleGetPayload<{ select: typeof slotScheduleSelection }>

/** A schedule as the setup form holds it, with a start that may have been emptied. */
export type SlotScheduleDraft = Omit<SlotSchedule, 'start'> & { start: Date | null }

export type Slot = { start: Date, end: Date }

/** A slot as a variant offers it, which is free while no registration holds it. */
export type SlotOfVariant = Slot & { id: number, free: boolean }
