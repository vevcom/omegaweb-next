import { defaultSlotScheduleLengths, slotScheduleLimits } from './constants'
import type { Slot, SlotSchedule, SlotScheduleDraft } from './types'

const MINUTE_MS = 60 * 1000

/** A time as the form and the slots show it, without seconds. */
export function wholeMinute(date: Date) {
    return new Date(Math.floor(date.getTime() / MINUTE_MS) * MINUTE_MS)
}

export function defaultSlotSchedule(start: Date | null): SlotScheduleDraft {
    return { start, ...defaultSlotScheduleLengths }
}

/**
 * The slots a schedule gives: one after another from its start, a break between each, as many as
 * end within its total length. With longer breaks, the first break that begins at or after each
 * whole multiple of `longBreakEveryMinutes` from the start is a longer one, and a multiple passed
 * during a longer break is served by it.
 *
 * The minutes are real ones, so across a change of the clock every slot keeps its length and the
 * clock in Oslo jumps between two of them. Takes a schedule within its limits, see `slotsOrProblem`.
 */
export function slotsOfSchedule(schedule: SlotSchedule): Slot[] {
    const at = (minutes: number) => new Date(schedule.start.getTime() + minutes * MINUTE_MS)
    const { slotMinutes, breakMinutes, totalMinutes, longBreakEveryMinutes, longBreakMinutes } = schedule
    const longBreak = longBreakEveryMinutes !== null && longBreakMinutes !== null
        ? { every: longBreakEveryMinutes, minutes: longBreakMinutes }
        : null
    const slots: Slot[] = []
    let nextLongBreakAt = longBreak?.every ?? Infinity
    for (let begins = 0; begins + slotMinutes <= totalMinutes;) {
        const ends = begins + slotMinutes
        slots.push({ start: at(begins), end: at(ends) })
        if (longBreak && ends >= nextLongBreakAt) {
            begins = ends + longBreak.minutes
            nextLongBreakAt = (Math.floor(begins / longBreak.every) + 1) * longBreak.every
        } else {
            begins = ends + breakMinutes
        }
    }
    return slots
}

function within(value: number, { min, max }: { min: number, max: number }) {
    return Number.isInteger(value) && value >= min && value <= max
}

function lengthsProblem(schedule: SlotScheduleDraft): string | null {
    const limits = slotScheduleLimits
    if (!within(schedule.slotMinutes, limits.slotMinutes)) {
        return `En tidsluke må vare fra ${limits.slotMinutes.min} til ${limits.slotMinutes.max} minutter.`
    }
    if (!within(schedule.breakMinutes, limits.breakMinutes)) {
        return `Pausen mellom tidslukene må være fra ${limits.breakMinutes.min} til ${limits.breakMinutes.max} minutter.`
    }
    if (!within(schedule.totalMinutes, limits.totalMinutes)) {
        return `Timeplanen må vare fra ${limits.totalMinutes.min} til ${limits.totalMinutes.max} minutter.`
    }
    if ((schedule.longBreakEveryMinutes === null) !== (schedule.longBreakMinutes === null)) {
        return 'En lengre pause må ha både en lengde og hvor ofte den kommer.'
    }
    if (schedule.longBreakEveryMinutes !== null
        && !within(schedule.longBreakEveryMinutes, limits.longBreakEveryMinutes)) {
        return `Det må gå fra ${limits.longBreakEveryMinutes.min} til ${limits.longBreakEveryMinutes.max} minutter `
            + 'mellom de lengre pausene.'
    }
    if (schedule.longBreakMinutes !== null && !within(schedule.longBreakMinutes, {
        min: schedule.breakMinutes + 1,
        max: limits.longBreakMinutes.max,
    })) {
        return `En lengre pause må være lengre enn den vanlige, og maks ${limits.longBreakMinutes.max} minutter.`
    }
    return null
}

/** The slots a schedule gives, or what stands in the way of it giving any. */
export function slotsOrProblem(
    schedule: SlotScheduleDraft,
): { slots: Slot[], problem: null } | { slots: null, problem: string } {
    const { start } = schedule
    if (!start || isNaN(start.getTime())) return { slots: null, problem: 'Sett når den første tidsluken starter.' }
    const problem = lengthsProblem(schedule)
    if (problem) return { slots: null, problem }

    const slots = slotsOfSchedule({ ...schedule, start })
    const { min, max } = slotScheduleLimits.slots
    if (slots.length < min) {
        return { slots: null, problem: 'Timeplanen gir ingen tidsluker. Gjør den lengre, eller tidslukene kortere.' }
    }
    if (slots.length > max) {
        return { slots: null, problem: `Timeplanen gir ${slots.length} tidsluker, men det kan være maks ${max}.` }
    }
    return { slots, problem: null }
}
