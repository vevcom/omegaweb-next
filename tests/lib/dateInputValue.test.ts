import { dateFromUtcInputValue, utcInputValue } from '@/lib/dates/dateInputValue'
import { describe, expect, test } from '@jest/globals'

describe('the value a date input posts', () => {
    const date = new Date('2026-11-20T18:30:00.000Z')

    test('is the date in UTC, to the minute when the time is included', () => {
        expect(utcInputValue(date, true)).toBe('2026-11-20T18:30')
        expect(utcInputValue(date, false)).toBe('2026-11-20')
    })

    test('is read back as UTC whatever zone the reader is in', () => {
        expect(dateFromUtcInputValue('2026-11-20T18:30')).toEqual(date)
        expect(dateFromUtcInputValue('2026-11-20')).toEqual(new Date('2026-11-20T00:00:00.000Z'))
    })

    test('gives an invalid date for a value that is none', () => {
        expect(Number.isNaN(dateFromUtcInputValue('').getTime())).toBe(true)
    })
})
