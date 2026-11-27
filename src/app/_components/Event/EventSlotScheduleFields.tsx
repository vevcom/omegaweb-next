'use client'
import Button from '@/components/UI/Button'
import DateInput from '@/components/UI/DateInput'
import NumberInput from '@/components/UI/NumberInput'
import { slotsOrProblem } from '@/services/events/slots/schedule'
import { defaultLongBreak, slotScheduleLimits } from '@/services/events/slots/constants'
import { slotClock, slotDay, slotTime } from '@/services/events/slots/display'
import type { Slot, SlotScheduleDraft } from '@/services/events/slots/types'

export const slotsInWords = (count: number) => (count === 1 ? '1 tidsluke' : `${count} tidsluker`)

/** The slots as they will be saved, in Oslo time, the day written out where it is not the first slot's. */
function SlotsPreview({ slots }: { slots: Slot[] }) {
    const first = slots[0]
    const last = slots[slots.length - 1]
    const onOtherDay = (date: Date) => (slotDay(date) === slotDay(first.start) ? '' : `${slotDay(date)} `)

    return <div className="flex flex-col gap-1">
        <p className="m-0 text-s text-base-content/80">
            {slotsInWords(slots.length)}, {slotDay(first.start)} {slotTime(first.start)}–
            {onOtherDay(last.end)}{slotTime(last.end)}
        </p>
        <ol className="m-0 p-0 list-none flex flex-wrap gap-1">
            {slots.map(slot => <li key={slot.start.getTime()} className="
                px-2 py-0.5 rounded-inner bg-base-100 text-s tabular-nums
            ">
                {onOtherDay(slot.start)}{slotClock(slot)}
            </li>)}
        </ol>
    </div>
}

/** The schedule a slotted variant makes its slots from, with the slots it gives or what stands in the way. */
export default function EventSlotScheduleFields({ schedule, onChange }: {
    schedule: SlotScheduleDraft,
    onChange: (schedule: SlotScheduleDraft) => void,
}) {
    const { slots, problem } = slotsOrProblem(schedule)
    const change = (changes: Partial<SlotScheduleDraft>) => onChange({ ...schedule, ...changes })
    const minutesInput = (
        label: string,
        field: 'slotMinutes' | 'breakMinutes' | 'totalMinutes' | 'longBreakEveryMinutes' | 'longBreakMinutes',
        limits: { min: number, max: number },
    ) => <NumberInput
        label={label}
        min={limits.min}
        max={limits.max}
        value={schedule[field] ?? ''}
        onChange={event => change({ [field]: Number(event.target.value) })}
        className="max-w-none! mt-0!"
    />
    const hasLongBreaks = schedule.longBreakEveryMinutes !== null

    return <div className="flex flex-col gap-3">
        <div className="
            grid grid-cols-2 gap-x-4 gap-y-2
            max-mobile:grid-cols-1
        ">
            <DateInput
                label="Første tidsluke starter"
                includeTime
                required
                defaultValue={schedule.start ?? undefined}
                onChange={event => change({ start: event.target.value ? new Date(event.target.value) : null })}
            />
            {minutesInput('Varer i alt, minutter', 'totalMinutes', slotScheduleLimits.totalMinutes)}
            {minutesInput('Hver tidsluke, minutter', 'slotMinutes', slotScheduleLimits.slotMinutes)}
            {minutesInput('Pause mellom, minutter', 'breakMinutes', slotScheduleLimits.breakMinutes)}
            {hasLongBreaks && <>
                {minutesInput(
                    'Lengre pause hvert n-te minutt fra start',
                    'longBreakEveryMinutes',
                    slotScheduleLimits.longBreakEveryMinutes,
                )}
                {minutesInput('Lengre pause, minutter', 'longBreakMinutes', {
                    min: schedule.breakMinutes + 1,
                    max: slotScheduleLimits.longBreakMinutes.max,
                })}
            </>}
        </div>
        {hasLongBreaks && <p className="m-0 text-s text-base-content/80">
            Den første pausen som begynner ved eller etter hvert slikt minutt, regnet fra første tidsluke, blir lengre.
        </p>}
        <Button
            type="button"
            variant="text"
            onClick={() => change(hasLongBreaks
                ? { longBreakEveryMinutes: null, longBreakMinutes: null }
                : defaultLongBreak)}
            className="self-start"
        >
            {hasLongBreaks ? 'Fjern de lengre pausene' : 'Legg inn lengre pauser'}
        </Button>
        {slots ? <SlotsPreview slots={slots} /> : <p className="m-0 text-s text-warning">{problem}</p>}
    </div>
}
