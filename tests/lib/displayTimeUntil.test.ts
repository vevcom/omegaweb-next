import { displayTimeUntil } from '@/lib/dates/displayTimeUntil'
import { describe, expect, test } from '@jest/globals'

describe('displayTimeUntil', () => {
    test('later the same Oslo day gives the clock', () => {
        expect(displayTimeUntil(new Date('2026-01-15T11:00:00Z'), new Date('2026-01-15T07:00:00Z')))
            .toBe('i dag kl. 12:00')
    })

    test('the next Oslo day is tomorrow, even less than a day away', () => {
        expect(displayTimeUntil(new Date('2026-01-16T07:00:00Z'), new Date('2026-01-15T21:00:00Z')))
            .toBe('i morgen kl. 08:00')
    })

    test('counts Oslo days, not UTC days, around midnight', () => {
        expect(displayTimeUntil(new Date('2026-01-15T23:30:00Z'), new Date('2026-01-15T12:00:00Z')))
            .toBe('i morgen kl. 00:30')
    })

    test('further ahead gives the number of Oslo days', () => {
        expect(displayTimeUntil(new Date('2026-01-18T06:00:00Z'), new Date('2026-01-15T12:00:00Z')))
            .toBe('om 3 dager')
    })

    test('counts whole days across the spring-forward transition', () => {
        expect(displayTimeUntil(new Date('2026-04-02T10:00:00Z'), new Date('2026-03-28T10:00:00Z')))
            .toBe('om 5 dager')
    })
})
