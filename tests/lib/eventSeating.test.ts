import {
    createSeatingPlan,
    displaySeats,
    moveGuest,
    parseSeats,
    reconcilePlan,
    resizePlan,
    seatingSummary,
    swapGuests,
} from '@/services/events/seating/plan'
import { describe, expect, test } from '@jest/globals'
import type { SeatingGuest, SeatingPlan, SeatingWishes } from '@/services/events/seating/plan'

const guest = (id: number, committees: string[] = []): SeatingGuest => ({ id, name: `Gjest ${id}`, committees })
const manyGuests = (count: number) => Array.from({ length: count }, (_, index) => guest(index + 1))
const tableOf = (plan: SeatingPlan, id: number) => plan.tables.findIndex(members => members.includes(id))
// Everyone wishes for three random others, always the same ones so the test is stable.
function wishesOf(guests: SeatingGuest[]): SeatingWishes {
    let state = 7
    const advance = () => {
        state = (state * 16807) % 2147483647
        return state
    }
    return Object.fromEntries(guests.map(({ id }) => {
        const wished: number[] = []
        while (wished.length < 3) {
            const candidate = guests[advance() % guests.length].id
            if (candidate !== id && !wished.includes(candidate)) wished.push(candidate)
        }
        return [id, wished]
    }))
}
const everyone = (plan: SeatingPlan) => [...plan.tables.flat(), ...plan.unseated].sort((first, second) => first - second)

describe('createSeatingPlan', () => {
    test('seats everyone once and respects the size of each table', () => {
        const guests = manyGuests(10)
        const plan = createSeatingPlan({ guests, wishes: {}, seats: [6, 2, 4] })
        expect(everyone(plan)).toEqual(guests.map(({ id }) => id))
        expect(plan.unseated).toEqual([])
        plan.tables.forEach((members, index) => expect(members.length).toBeLessThanOrEqual([6, 2, 4][index]))
    })

    test('leaves out those who do not fit', () => {
        const plan = createSeatingPlan({ guests: manyGuests(10), wishes: {}, seats: [4, 4] })
        expect(plan.tables.flat()).toHaveLength(8)
        expect(plan.unseated).toHaveLength(2)
    })

    test('spreads empty seats over the tables', () => {
        const plan = createSeatingPlan({ guests: manyGuests(14), wishes: {}, seats: [8, 8, 8] })
        plan.tables.forEach(members => expect(members.length).toBeGreaterThanOrEqual(4))
        plan.tables.forEach(members => expect(members.length).toBeLessThanOrEqual(5))
    })

    test('seats those wishing for each other together', () => {
        const guests = manyGuests(12)
        const wishes = { 1: [12], 12: [1], 2: [11], 11: [2], 3: [10], 10: [3] }
        const plan = createSeatingPlan({ guests, wishes, seats: [4, 4, 4] })
        Object.entries(wishes).forEach(([id, [wished]]) => {
            expect(tableOf(plan, Number(id))).toBe(tableOf(plan, wished))
        })
    })

    test('keeps a committee together', () => {
        const guests = [...manyGuests(8), guest(9, ['Vevcom']), guest(10, ['Vevcom']), guest(11, ['Vevcom'])]
        const plan = createSeatingPlan({ guests, wishes: {}, seats: [4, 4, 4] })
        expect(new Set([9, 10, 11].map(id => tableOf(plan, id))).size).toBe(1)
    })

    test('splits a committee rather than leave someone without a wish', () => {
        const guests = [guest(1, ['Vevcom']), guest(2, ['Vevcom']), guest(3), guest(4)]
        const plan = createSeatingPlan({ guests, wishes: { 2: [3] }, seats: [2, 2] })
        expect(tableOf(plan, 2)).toBe(tableOf(plan, 3))
    })

    test('keeps locked guests at their table, also against their wishes', () => {
        const plan = createSeatingPlan({
            guests: manyGuests(8),
            wishes: { 1: [2], 2: [1] },
            seats: [4, 4],
            locked: { 1: 0, 2: 1 },
        })
        expect(tableOf(plan, 1)).toBe(0)
        expect(tableOf(plan, 2)).toBe(1)
    })

    test('gives the same plan for the same seed', () => {
        const guests = manyGuests(20)
        const wishes = wishesOf(guests)
        expect(createSeatingPlan({ guests, wishes, seats: [10, 10], seed: 3 }))
            .toEqual(createSeatingPlan({ guests, wishes, seats: [10, 10], seed: 3 }))
    })

    test('gives nearly everyone at a big dinner a wish, in about a second', () => {
        const guests = manyGuests(200)
        const wishes = wishesOf(guests)
        const started = Date.now()
        const plan = createSeatingPlan({ guests, wishes, seats: Array<number>(20).fill(10) })
        expect(Date.now() - started).toBeLessThan(3000)
        expect(seatingSummary(plan, guests, wishes).gotAWish).toBeGreaterThanOrEqual(185)
    })
})

describe('tables', () => {
    test('reads the tables as they are written', () => {
        expect(parseSeats('2x8, 10;6')).toEqual([8, 8, 10, 6])
        expect(parseSeats('abc')).toBeNull()
        expect(parseSeats('0')).toBeNull()
        expect(parseSeats('')).toBeNull()
        expect(parseSeats('999x8')).toBeNull()
    })

    test('writes equal tables the short way', () => {
        expect(displaySeats([8, 8])).toBe('2x8')
        expect(displaySeats([10, 8])).toBe('10, 8')
    })

    test('moves those who no longer fit away from their table', () => {
        const resized = resizePlan({ tables: [[1, 2, 3], [4]], unseated: [5] }, [2])
        expect(resized).toEqual({ tables: [[1, 2]], unseated: [5, 3, 4] })
    })

    test('follows who is registered', () => {
        expect(reconcilePlan({ tables: [[1, 2]], unseated: [3] }, [2, 3, 4])).toEqual({ tables: [[2]], unseated: [3, 4] })
    })
})

describe('moving by hand', () => {
    const plan = { tables: [[1, 2], [3]], unseated: [4] }

    test('moves a guest to a table and off it again', () => {
        expect(moveGuest(plan, 1, 1)).toEqual({ tables: [[2], [3, 1]], unseated: [4] })
        expect(moveGuest(plan, 4, 0)).toEqual({ tables: [[1, 2, 4], [3]], unseated: [] })
        expect(moveGuest(plan, 3, null)).toEqual({ tables: [[1, 2], []], unseated: [4, 3] })
    })

    test('swaps two guests', () => {
        expect(swapGuests(plan, 1, 4)).toEqual({ tables: [[4, 2], [3]], unseated: [1] })
    })
})
