import { osloDateTime } from '@/lib/dates/oslo'
import type { Slot } from './types'

export const slotDay = (date: Date) => osloDateTime(date).toFormat('dd.MM.')

export const slotTime = (date: Date) => osloDateTime(date).toFormat('HH:mm')

/** From and to on the clock in Oslo. */
export const slotClock = (slot: Slot) => `${slotTime(slot.start)}–${slotTime(slot.end)}`

export const displaySlot = (slot: Slot) => `${slotDay(slot.start)} ${slotClock(slot)}`

/** Whether the slots are all on one day in Oslo, which is then said once. */
export const onOneDay = (slots: Slot[]) => slots.every(slot => slotDay(slot.start) === slotDay(slots[0].start))
