import { inferClassLadder } from '@/prisma/seeder/src/dobbelOmega/classLadder'
import { CURRENT_OMEGA_ORDER, FIRST_OMEGA_ORDER } from '@/prisma/seeder/src/standardContent/seedOrders'
import { describe, expect, jest, test } from '@jest/globals'

// The manifest logs to a file in the working directory, which a test has no business writing.
jest.mock('../../src/prisma/seeder/src/dobbelOmega/manifest', () => ({
    __esModule: true,
    default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

const current = CURRENT_OMEGA_ORDER
const first = FIRST_OMEGA_ORDER

describe('inferClassLadder', () => {
    test('a five year student climbs one class per order from the order they were taken up in', () => {
        expect(inferClassLadder({ id: 1, order: current - 4, yearOfStudy: 5, yearsInProgramme: 5 })).toEqual([
            { year: 1, order: current - 4, active: false },
            { year: 2, order: current - 3, active: false },
            { year: 3, order: current - 2, active: false },
            { year: 4, order: current - 1, active: false },
            { year: 5, order: current, active: true },
        ])
    })

    test('a two year master starts in class 4', () => {
        expect(inferClassLadder({ id: 1, order: current - 1, yearOfStudy: 5, yearsInProgramme: 2 })).toEqual([
            { year: 4, order: current - 1, active: false },
            { year: 5, order: current, active: true },
        ])
    })

    test('a siving who graduated a while ago holds no active class', () => {
        expect(inferClassLadder({ id: 1, order: current - 9, yearOfStudy: 10, yearsInProgramme: 5 })).toEqual([
            { year: 1, order: current - 9, active: false },
            { year: 2, order: current - 8, active: false },
            { year: 3, order: current - 7, active: false },
            { year: 4, order: current - 6, active: false },
            { year: 5, order: current - 5, active: false },
            { year: 6, order: current - 4, active: false },
        ])
    })

    test('a user without a programme holds no class', () => {
        expect(inferClassLadder({ id: 1, order: current, yearOfStudy: 1, yearsInProgramme: 0 })).toEqual([])
    })

    test('never reaches past the current order', () => {
        // Taken up this order but in their third year: the orders the first two years would be of
        // do not exist, and omegaweb-basic does not say where the user was before.
        expect(inferClassLadder({ id: 1, order: current, yearOfStudy: 3, yearsInProgramme: 5 })).toEqual([
            { year: 3, order: current, active: true },
        ])
    })

    test('keeps the rungs that fit under the current order, and the year the user is in now', () => {
        expect(inferClassLadder({ id: 1, order: current - 1, yearOfStudy: 3, yearsInProgramme: 5 })).toEqual([
            { year: 1, order: current - 1, active: false },
            { year: 3, order: current, active: true },
        ])
    })

    test('an order past the current one is brought down to it', () => {
        expect(inferClassLadder({ id: 1, order: current + 1, yearOfStudy: 1, yearsInProgramme: 5 })).toEqual([
            { year: 1, order: current, active: true },
        ])
    })

    test('an order before the first one is brought up to it', () => {
        // Omegaweb-basic leaves the order at 0 for a user it has none for, and a bachelor ladder
        // counts further back from there - no such order exists, so every rung lands on the first.
        expect(inferClassLadder({ id: 1, order: 0, yearOfStudy: 3, yearsInProgramme: 3 })).toEqual([
            { year: 3, order: first, active: false },
        ])
    })
})
