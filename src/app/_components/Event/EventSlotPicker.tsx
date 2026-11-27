'use client'
import { displaySlot, slotClock, slotDay } from '@/services/events/slots/display'
import { useId } from 'react'
import type { SlotOfVariant } from '@/services/events/slots/types'

function stateInWords(slot: SlotOfVariant, held: boolean) {
    if (held) return 'din tidsluke'
    return slot.free ? 'ledig' : 'opptatt'
}

/**
 * The slots of a variant in Oslo time, the day written once when they are all on one. The free
 * ones are picked while picking is open, and the one held is marked. Each says in words whether it
 * is free, taken or held, and a taken one stays reachable to be heard.
 */
export default function EventSlotPicker({ slots, heldSlotId, pickedSlotId, onPick, picking }: {
    slots: SlotOfVariant[],
    heldSlotId: number | null,
    pickedSlotId: number | null,
    onPick: (slotId: number) => void,
    picking: boolean,
}) {
    const summaryId = useId()
    if (slots.length === 0) return null
    const oneDay = slots.every(slot => slotDay(slot.start) === slotDay(slots[0].start))
    const free = slots.filter(slot => slot.free).length

    return <div className="flex flex-col gap-1">
        <p id={summaryId} className="m-0 text-s text-base-content/80">
            Tidsluker{oneDay && ` ${slotDay(slots[0].start)}`}, {free} av {slots.length} ledige
        </p>
        <ol aria-labelledby={summaryId} className="m-0 p-0 list-none flex flex-wrap gap-1">
            {slots.map(slot => {
                const held = slot.id === heldSlotId
                const picked = slot.id === pickedSlotId
                const pickable = picking && slot.free
                return <li key={slot.id}>
                    <button
                        type="button"
                        disabled={!picking}
                        aria-disabled={!pickable}
                        aria-pressed={picked}
                        onClick={() => {
                            if (pickable) onPick(slot.id)
                        }}
                        className={`
                            px-2 py-0.5 rounded-inner text-s tabular-nums border-2
                            ${held ? 'bg-primary text-primary-content border-primary' : 'bg-base-200 border-transparent'}
                            ${picked ? 'border-primary!' : ''}
                            ${!held && !slot.free ? 'line-through opacity-60' : ''}
                            ${pickable ? `
                                cursor-pointer
                                hover:border-primary/60
                            ` : 'cursor-default'}
                        `}
                    >
                        {oneDay ? slotClock(slot) : displaySlot(slot)}
                        <span className="sr-only">, {stateInWords(slot, held)}</span>
                    </button>
                </li>
            })}
        </ol>
    </div>
}
