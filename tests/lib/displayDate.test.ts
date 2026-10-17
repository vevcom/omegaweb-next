import { displayDate } from '@/lib/dates/displayDate'
import { describe, expect, test } from '@jest/globals'

describe('displayDate', () => {
    test('formats a winter instant (CET, UTC+1)', () => {
        expect(displayDate(new Date('2024-01-15T12:00:00Z'))).toBe('15.01.2024, 13:00:00')
    })

    test('formats a summer instant (CEST, UTC+2)', () => {
        expect(displayDate(new Date('2024-07-15T12:00:00Z'))).toBe('15.07.2024, 14:00:00')
    })

    test('flips from CET to CEST across the spring-forward transition', () => {
        expect(displayDate(new Date('2024-03-31T00:59:00Z'))).toBe('31.03.2024, 01:59:00')
        expect(displayDate(new Date('2024-03-31T01:00:00Z'))).toBe('31.03.2024, 03:00:00')
    })

    test('flips from CEST to CET across the fall-back transition', () => {
        expect(displayDate(new Date('2024-10-27T00:59:00Z'))).toBe('27.10.2024, 02:59:00')
        expect(displayDate(new Date('2024-10-27T01:00:00Z'))).toBe('27.10.2024, 02:00:00')
    })

    test('omits time when includeTime is false', () => {
        expect(displayDate(new Date('2024-01-15T12:00:00Z'), false)).toBe('15.01.2024')
    })
})
