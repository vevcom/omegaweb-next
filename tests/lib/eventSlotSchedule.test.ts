import { defaultSlotSchedule, slotsOfSchedule, slotsOrProblem } from '@/services/events/slots/schedule'
import { osloDateTime } from '@/lib/dates/oslo'
import { describe, expect, test } from '@jest/globals'
import type { SlotSchedule } from '@/services/events/slots/types'

const MINUTE = 60 * 1000
const start = new Date('2027-01-20T09:00:00Z')

const schedule = (lengths: Partial<SlotSchedule> = {}): SlotSchedule => ({
    ...defaultSlotSchedule(start),
    start,
    ...lengths,
})

/** The minutes from the start each slot begins at. */
const startsOf = (lengths: Partial<SlotSchedule>) => slotsOfSchedule(schedule(lengths))
    .map(slot => (slot.start.getTime() - start.getTime()) / MINUTE)

const countOf = (lengths: Partial<SlotSchedule>) => slotsOrProblem(schedule(lengths)).slots?.length
const problemOf = (lengths: Partial<SlotSchedule>) => slotsOrProblem(schedule(lengths)).problem

describe('the slots of a schedule', () => {
    test('are eight of ten minutes, five apart, by default', () => {
        const slots = slotsOfSchedule(schedule())

        expect(startsOf({})).toEqual([0, 15, 30, 45, 60, 75, 90, 105])
        slots.forEach(slot => expect(slot.end.getTime() - slot.start.getTime()).toBe(10 * MINUTE))
    })

    test('are the whole part of (total + break) / (slot + break), without longer breaks', () => {
        for (const slotMinutes of [3, 7, 10, 120]) {
            for (const breakMinutes of [0, 5, 60]) {
                for (let totalMinutes = 1; totalMinutes <= 720; totalMinutes += 17) {
                    const lengths = { slotMinutes, breakMinutes, totalMinutes }
                    expect(slotsOfSchedule(schedule(lengths))).toHaveLength(
                        Math.floor((totalMinutes + breakMinutes) / (slotMinutes + breakMinutes))
                    )
                }
            }
        }
    })

    test('end within the total, a last one ending on it included, and what is left over is not a slot', () => {
        expect(startsOf({ totalMinutes: 115 })).toEqual([0, 15, 30, 45, 60, 75, 90, 105])
        expect(startsOf({ totalMinutes: 114 })).toEqual([0, 15, 30, 45, 60, 75, 90])
        expect(startsOf({ totalMinutes: 110 })).toEqual([0, 15, 30, 45, 60, 75, 90])
    })

    test('follow one another without a break', () => {
        expect(startsOf({ slotMinutes: 20, breakMinutes: 0, totalMinutes: 60 })).toEqual([0, 20, 40])
    })

    test('are at their shortest three minutes, and at their longest two hours', () => {
        expect(countOf({ slotMinutes: 3, breakMinutes: 0, totalMinutes: 30 })).toBe(10)
        expect(countOf({ slotMinutes: 120, breakMinutes: 0, totalMinutes: 720 })).toBe(6)
        expect(problemOf({ slotMinutes: 2 })).toBe('En tidsluke må vare fra 3 til 120 minutter.')
        expect(problemOf({ slotMinutes: 121 })).toBe('En tidsluke må vare fra 3 til 120 minutter.')
        expect(problemOf({ slotMinutes: 10.5 })).toBe('En tidsluke må vare fra 3 til 120 minutter.')
    })

    test('have a break of up to an hour, in a schedule of up to twelve hours', () => {
        expect(countOf({ breakMinutes: 60, totalMinutes: 720 })).toBe(11)
        expect(problemOf({ breakMinutes: 61 })).toBe('Pausen mellom tidslukene må være fra 0 til 60 minutter.')
        expect(problemOf({ breakMinutes: -1 })).toBe('Pausen mellom tidslukene må være fra 0 til 60 minutter.')
        expect(problemOf({ totalMinutes: 721 })).toBe('Timeplanen må vare fra 1 til 720 minutter.')
    })

    test('are at most a hundred', () => {
        expect(countOf({ slotMinutes: 3, breakMinutes: 0, totalMinutes: 300 })).toBe(100)
        expect(problemOf({ slotMinutes: 3, breakMinutes: 0, totalMinutes: 303 }))
            .toBe('Timeplanen gir 101 tidsluker, men det kan være maks 100.')
    })

    test('are at least one', () => {
        expect(countOf({ slotMinutes: 120, totalMinutes: 120 })).toBe(1)
        expect(problemOf({ slotMinutes: 120, totalMinutes: 119 }))
            .toBe('Timeplanen gir ingen tidsluker. Gjør den lengre, eller tidslukene kortere.')
    })

    test('need a start', () => {
        expect(slotsOrProblem({ ...schedule(), start: null }).problem).toBe('Sett når den første tidsluken starter.')
        expect(slotsOrProblem({ ...schedule(), start: new Date('') }).problem).toBe('Sett når den første tidsluken starter.')
    })
})

describe('a longer break', () => {
    const hourly = { longBreakEveryMinutes: 60, longBreakMinutes: 10 }

    test('is the first break that begins at or after each multiple of its interval from the start', () => {
        expect(startsOf({ ...hourly })).toEqual([0, 15, 30, 45, 60, 80, 95, 110])
        expect(startsOf({ ...hourly, totalMinutes: 240 }))
            .toEqual([0, 15, 30, 45, 60, 80, 95, 110, 130, 145, 160, 175, 195, 210, 225])
    })

    test('serves a multiple that passes while it lasts', () => {
        const lengths = { slotMinutes: 10, breakMinutes: 0, longBreakEveryMinutes: 30, longBreakMinutes: 40 }
        expect(startsOf(lengths)).toEqual([0, 10, 20, 70, 80])
    })

    test('has both a length and an interval, and is longer than the ordinary break', () => {
        expect(problemOf({ longBreakEveryMinutes: 60, longBreakMinutes: null }))
            .toBe('En lengre pause må ha både en lengde og hvor ofte den kommer.')
        expect(problemOf({ longBreakEveryMinutes: 9, longBreakMinutes: 10 }))
            .toBe('Det må gå fra 10 til 720 minutter mellom de lengre pausene.')
        expect(problemOf({ breakMinutes: 5, longBreakEveryMinutes: 60, longBreakMinutes: 5 }))
            .toBe('En lengre pause må være lengre enn den vanlige, og maks 120 minutter.')
        expect(problemOf({ longBreakEveryMinutes: 60, longBreakMinutes: 121 }))
            .toBe('En lengre pause må være lengre enn den vanlige, og maks 120 minutter.')
        expect(problemOf({ breakMinutes: 5, longBreakEveryMinutes: 60, longBreakMinutes: 6 })).toBeNull()
    })
})

describe('a schedule across a change of the clock', () => {
    const clockOf = (slots: { start: Date }[]) => slots.map(slot => osloDateTime(slot.start).toFormat('HH:mm'))
    const across = (first: string) => slotsOfSchedule({ ...schedule(), start: new Date(first), totalMinutes: 60 })

    test('keeps every slot its length, and the clock in Oslo jumps forward between two of them', () => {
        // 01:30 in winter time, half an hour before the clock goes from 02:00 to 03:00.
        const slots = across('2027-03-28T00:30:00Z')

        expect(clockOf(slots)).toEqual(['01:30', '01:45', '03:00', '03:15'])
        slots.forEach(slot => expect(slot.end.getTime() - slot.start.getTime()).toBe(10 * MINUTE))
    })

    test('keeps every slot its length, and the clock in Oslo goes back between two of them', () => {
        // 02:30 in summer time, half an hour before the clock goes from 03:00 back to 02:00.
        const slots = across('2027-10-31T00:30:00Z')

        expect(clockOf(slots)).toEqual(['02:30', '02:45', '02:00', '02:15'])
        slots.forEach(slot => expect(slot.end.getTime() - slot.start.getTime()).toBe(10 * MINUTE))
    })
})
