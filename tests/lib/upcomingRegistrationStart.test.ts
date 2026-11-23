import { upcomingRegistrationStart } from '@/services/events/upcomingRegistrationStart'
import { describe, expect, test } from '@jest/globals'

const HOUR = 60 * 60 * 1000
const at = (hours: number) => new Date(Date.UTC(2026, 0, 1) + hours * HOUR)
const now = at(0)

describe('upcomingRegistrationStart', () => {
    test('is the earliest start of the variants that take registration', () => {
        expect(upcomingRegistrationStart([
            { takesRegistration: true, registrationStart: at(48) },
            { takesRegistration: true, registrationStart: at(24) },
        ], now)).toEqual(at(24))
    })

    test('leaves out a variant without places, whose start is when it was made', () => {
        expect(upcomingRegistrationStart([
            { takesRegistration: false, registrationStart: at(-1) },
            { takesRegistration: true, registrationStart: at(24) },
        ], now)).toEqual(at(24))
    })

    test('is null once a variant taking registration has opened', () => {
        expect(upcomingRegistrationStart([
            { takesRegistration: true, registrationStart: at(-1) },
            { takesRegistration: true, registrationStart: at(24) },
        ], now)).toBeNull()
    })

    test('is null when no variant takes registration', () => {
        expect(upcomingRegistrationStart([{ takesRegistration: false, registrationStart: at(24) }], now)).toBeNull()
    })
})
