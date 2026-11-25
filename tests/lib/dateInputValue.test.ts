/**
 * @jest-environment-options {"timeZone": "Europe/Oslo"}
 */
import { dateFromUtcInputValue, utcInputValue } from '@/lib/dates/dateInputValue'
import { Zpn } from '@/lib/fields/zpn'
import { describe, expect, test } from '@jest/globals'

test('the file runs in Europe/Oslo, where a date and time that names no zone is local time', () => {
    expect(new Date('2026-07-01T12:00').toISOString()).toBe('2026-07-01T10:00:00.000Z')
})

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

    test('is read in the zone it names, when it names one', () => {
        expect(dateFromUtcInputValue('2026-11-20T18:30:00.000Z')).toEqual(date)
        expect(dateFromUtcInputValue('2026-11-20T19:30+01:00')).toEqual(date)
    })

    test('gives an invalid date for a value that is none', () => {
        expect(Number.isNaN(dateFromUtcInputValue('').getTime())).toBe(true)
    })
})

describe('a date field', () => {
    const schema = Zpn.date({ label: 'Start' })

    test('reads the value of a date input as UTC', () => {
        expect(schema.parse('2026-11-20T18:30')).toEqual(new Date('2026-11-20T18:30:00.000Z'))
        expect(schema.parse('2026-07-01T12:00')).toEqual(new Date('2026-07-01T12:00:00.000Z'))
        expect(schema.parse('2026-11-20')).toEqual(new Date('2026-11-20T00:00:00.000Z'))
    })

    test('reads a value that names its zone in that zone', () => {
        expect(schema.parse('2026-11-20T18:30:00.000Z')).toEqual(new Date('2026-11-20T18:30:00.000Z'))
        expect(schema.parse('2026-11-20T19:30+01:00')).toEqual(new Date('2026-11-20T18:30:00.000Z'))
        expect(schema.parse('2026-07-01T14:00:00+02:00')).toEqual(new Date('2026-07-01T12:00:00.000Z'))
    })

    test('keeps a date as it is', () => {
        const date = new Date('2026-11-20T18:30:00.000Z')
        expect(schema.parse(date)).toEqual(date)
    })

    test('refuses a value that is no date', () => {
        expect(schema.safeParse('').error?.issues[0].message).toBe('Start er ugyldig')
    })

    // Oslo goes from 02:00 to 03:00 at 01:00 UTC on 29 March, and from 03:00 back to 02:00 at 01:00 UTC on 25 October.
    test.each([
        ['goes forward', '2026-03-28T23:00:00.000Z'],
        ['goes back', '2026-10-24T23:00:00.000Z'],
    ])('reads back what a date input posts, in the hours the clock %s', (_change, from) => {
        const quarterHour = 15 * 60 * 1000
        const start = new Date(from).getTime()
        for (let time = start; time <= start + 4 * 60 * 60 * 1000; time += quarterHour) {
            const date = new Date(time)
            expect(schema.parse(utcInputValue(date, true))).toEqual(date)
        }
    })
})
