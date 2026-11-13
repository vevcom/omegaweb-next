import { nightOf, pickDate } from '@/app/(omegaweb)/cabin/book/CabinCalendar'
import { describe, expect, test } from '@jest/globals'
import type { CalendarWindow } from '@/app/(omegaweb)/cabin/book/CabinCalendar'

const date = (day: number) => new Date(Date.UTC(2030, 0, day))

// Bookable from the 1st up to the 20th, with the nights of the 10th and 11th taken.
const calendarWindow: CalendarWindow = {
    today: date(1),
    bookingUntil: date(20),
    bookings: [{ type: 'CABIN', start: date(10), end: date(12) }],
}

describe('the cabin calendar', () => {
    test('tells free, booked and unreleased nights apart', () => {
        expect(nightOf(date(9), calendarWindow)).toBe('free')
        expect(nightOf(date(10), calendarWindow)).toBe('booked')
        expect(nightOf(date(12), calendarWindow)).toBe('free')
        expect(nightOf(date(20), calendarWindow)).toBe('closed')
    })

    test('a stay can end on the day a booked night starts', () => {
        expect(pickDate({ start: date(8) }, date(10), calendarWindow)).toEqual({ start: date(8), end: date(10) })
    })

    test('a stay cannot run over a booked night, so the pick starts a new one', () => {
        expect(pickDate({ start: date(8) }, date(13), calendarWindow)).toEqual({ start: date(13) })
    })

    test('a booked night cannot start a stay', () => {
        expect(pickDate({}, date(10), calendarWindow)).toBeNull()
    })

    test('a stay can end on the last released day, but not start on it', () => {
        expect(pickDate({ start: date(18) }, date(20), calendarWindow)).toEqual({ start: date(18), end: date(20) })
        expect(pickDate({}, date(20), calendarWindow)).toBeNull()
    })
})
