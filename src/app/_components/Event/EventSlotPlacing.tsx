'use client'
import { slotsInWords } from './EventSlotScheduleFields'
import { placementsOfDraft } from '@/services/events/setupDraft'
import { displaySlot, onOneDay, slotDay } from '@/services/events/slots/display'
import OptionCards from '@/components/UI/OptionCards'
import { SelectString } from '@/components/UI/Select'
import type { VariantDraft } from '@/services/events/setupDraft'
import type { Slot } from '@/services/events/slots/types'

const WAITING_LIST = 'WAITING_LIST'

const placings = [
    { value: 'PLACE', title: 'Plasser hver', hint: 'I en ny tidsluke, eller på ventelisten når de ikke rekker' },
    {
        value: 'REMOVE',
        title: 'Meld av alle',
        hint: 'Alle påmeldte til varianten, også de på ventelisten, og det de har betalt gis tilbake',
    },
] as const

/** Whether two are placed in one slot, which the save refuses. */
function sharesASlot(placements: { slotStart: Date | null }[]) {
    const starts = placements.flatMap(placement => (placement.slotStart ? [placement.slotStart.getTime()] : []))
    return new Set(starts).size !== starts.length
}

/**
 * Where those who hold a slot go when the schedule of their variant gives other slots: each to one
 * of the new slots or to the waiting list, or all of them removed. Saved with the form, and those
 * whose time changes are told of it then.
 */
export default function EventSlotPlacing({ variant, slots, onChange }: {
    variant: VariantDraft,
    /** The slots the schedule gives now, see `slotsToPlaceIn`. */
    slots: Slot[],
    onChange: (slotPlacing: VariantDraft['slotPlacing']) => void,
}) {
    const { slotPlacing } = variant
    const placements = placementsOfDraft(variant, slots)
    const oneDay = onOneDay(slots)
    const slotOptions = [
        ...slots.map(slot => ({ value: String(slot.start.getTime()), label: displaySlot(slot) })),
        { value: WAITING_LIST, label: 'Venteliste' },
    ]
    const twoInOneSlot = !slotPlacing.removeEveryone && sharesASlot(placements)
    // The save refuses these, as it keeps a place that is paid for.
    const paidWaiting = slotPlacing.removeEveryone
        ? []
        : placements.filter(placement => placement.paid && !placement.slotStart)

    return <div className="flex flex-col gap-2">
        <p className="m-0 font-medium">De som har en tidsluke</p>
        <p className="m-0 text-s text-base-content/80">
            Timeplanen gir {slotsInWords(slots.length)}{oneDay && ` ${slotDay(slots[0].start)}`}, og ikke de som er
            lagret. {placements.length === 1 ? 'Én har' : `${placements.length} har`} en tidsluke. De som får en annen
            tid, får beskjed når du lagrer.
        </p>
        <OptionCards
            options={[...placings]}
            value={slotPlacing.removeEveryone ? 'REMOVE' : 'PLACE'}
            onChange={choice => onChange({ ...slotPlacing, removeEveryone: choice === 'REMOVE' })}
        />
        {!slotPlacing.removeEveryone && <ul className="m-0 p-0 list-none flex flex-col gap-1">
            {placements.map(placement => <li key={placement.registrationId} className="
                grid grid-cols-[1fr_1fr_minmax(0,20rem)] items-center gap-2
                max-mobile:grid-cols-1
            ">
                <span>{placement.name}</span>
                <span className="text-s text-base-content/80 tabular-nums">Hadde {displaySlot(placement.slot)}</span>
                <SelectString
                    label={`Ny tidsluke for ${placement.name}`}
                    options={slotOptions}
                    value={placement.slotStart ? String(placement.slotStart.getTime()) : WAITING_LIST}
                    onChange={value => onChange({
                        ...slotPlacing,
                        chosen: {
                            ...slotPlacing.chosen,
                            [placement.registrationId]: value === WAITING_LIST ? null : Number(value),
                        },
                    })}
                    className="max-w-none! mt-0!"
                />
            </li>)}
        </ul>}
        <p role="status" className="
            m-0 text-s text-warning
            empty:hidden
        ">
            {twoInOneSlot && 'To er plassert i samme tidsluke. '}
            {paidWaiting.length > 0 && `${paidWaiting.map(placement => placement.name).join(' og ')} har betalt for `
                + 'plassen og kan ikke settes på ventelisten. Gi dem en tidsluke, eller meld dem av.'}
        </p>
    </div>
}
