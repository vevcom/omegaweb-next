import {
    createSeatingPlan,
    displaySeats,
    moveGuest,
    nearnessOf,
    parseSeats,
    placesOf,
    reconcilePlan,
    resizePlan,
    seatingSummary,
    sidesOf,
    swapGuests,
} from '@/services/events/seating/plan'
import { DEFAULT_SEATING_POINTS } from '@/services/events/seating/constants'
import { describe, expect, test } from '@jest/globals'
import type { SeatingGuest, SeatingPlan, SeatingWishes } from '@/services/events/seating/plan'

const guest = (id: number, committees: string[] = []): SeatingGuest => ({ id, name: `Gjest ${id}`, committees })
const manyGuests = (count: number) => Array.from({ length: count }, (_, index) => guest(index + 1))
const tableOf = (plan: SeatingPlan, id: number) => plan.tables.findIndex(members => members.includes(id))
const seatedAt = (table: (number | null)[]) => table.filter(guestId => guestId !== null)
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
const everyone = (plan: SeatingPlan) => [...plan.tables.flatMap(seatedAt), ...plan.unseated]
    .sort((first, second) => first - second)

describe('createSeatingPlan', () => {
    test('seats everyone once and respects the size of each table', () => {
        const guests = manyGuests(10)
        const plan = createSeatingPlan({ guests, wishes: {}, seats: [6, 2, 4] })
        expect(everyone(plan)).toEqual(guests.map(({ id }) => id))
        expect(plan.unseated).toEqual([])
        expect(plan.tables.map(table => table.length)).toEqual([6, 2, 4])
    })

    test('leaves out those who do not fit', () => {
        const plan = createSeatingPlan({ guests: manyGuests(10), wishes: {}, seats: [4, 4] })
        expect(plan.tables.flatMap(seatedAt)).toHaveLength(8)
        expect(plan.unseated).toHaveLength(2)
    })

    test('spreads empty seats over the tables', () => {
        const plan = createSeatingPlan({ guests: manyGuests(14), wishes: {}, seats: [8, 8, 8] })
        plan.tables.forEach(table => expect(seatedAt(table).length).toBeGreaterThanOrEqual(4))
        plan.tables.forEach(table => expect(seatedAt(table).length).toBeLessThanOrEqual(5))
    })

    test('seats those wishing for each other beside or across from each other', () => {
        const guests = manyGuests(12)
        const wishes = { 1: [12], 12: [1], 2: [11], 11: [2], 3: [10], 10: [3] }
        const plan = createSeatingPlan({ guests, wishes, seats: [4, 4, 4] })
        const places = placesOf(plan)
        Object.entries(wishes).forEach(([id, [wished]]) => {
            const [one, other] = [places.get(Number(id)), places.get(wished)]
            expect(one?.table).toBe(other?.table)
            expect(['beside', 'across']).toContain(nearnessOf(one?.seat ?? 0, other?.seat ?? 0, 4))
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

    test('keeps a committee together over a wish when splitting it costs more', () => {
        const guests = [guest(1, ['Vevcom']), guest(2, ['Vevcom']), guest(3), guest(4)]
        const points = { ...DEFAULT_SEATING_POINTS, committeeSplit: 30 }
        const plan = createSeatingPlan({ guests, wishes: { 2: [3] }, seats: [2, 2], points })
        expect(tableOf(plan, 1)).toBe(tableOf(plan, 2))
    })

    test('keeps locked guests in their seat, also against their wishes', () => {
        const plan = createSeatingPlan({
            guests: manyGuests(8),
            wishes: { 1: [2], 2: [1] },
            seats: [4, 4],
            locked: { 1: { table: 0, seat: 3 }, 2: { table: 1, seat: 0 } },
        })
        expect(plan.tables[0][3]).toBe(1)
        expect(plan.tables[1][0]).toBe(2)
    })

    test('gives the same plan for the same seed', () => {
        const guests = manyGuests(20)
        const wishes = wishesOf(guests)
        expect(createSeatingPlan({ guests, wishes, seats: [10, 10], seed: 3 }))
            .toEqual(createSeatingPlan({ guests, wishes, seats: [10, 10], seed: 3 }))
    })

    test('seats most at a big dinner near a wish, without taking long', () => {
        const guests = manyGuests(200)
        const wishes = wishesOf(guests)
        const started = Date.now()
        const plan = createSeatingPlan({ guests, wishes, seats: Array<number>(20).fill(10) })
        // About two seconds on a laptop. The bound is loose since CI runs it slower, next to other tests.
        expect(Date.now() - started).toBeLessThan(15_000)
        expect(seatingSummary(plan, guests, wishes).gotAWish).toBeGreaterThanOrEqual(175)
    }, 30_000)
})

describe('seats', () => {
    test('are along two facing sides, the odd one out on the first', () => {
        expect(sidesOf(8)).toEqual([[0, 1, 2, 3], [4, 5, 6, 7]])
        expect(sidesOf(5)).toEqual([[0, 1, 2], [3, 4]])
    })

    test('are near by side, across and diagonally', () => {
        expect(nearnessOf(1, 2, 8)).toBe('beside')
        expect(nearnessOf(1, 5, 8)).toBe('across')
        expect(nearnessOf(1, 6, 8)).toBe('diagonal')
        expect(nearnessOf(1, 3, 8)).toBe('table')
        expect(nearnessOf(3, 4, 8)).toBe('table')
    })
})

describe('tables', () => {
    test('reads the tables as they are written', () => {
        expect(parseSeats('2x8, 10;6')).toEqual([8, 8, 10, 6])
        expect(parseSeats('abc')).toBeNull()
        expect(parseSeats('0')).toBeNull()
        expect(parseSeats('')).toBeNull()
        expect(parseSeats('999x8')).toBeNull()
        expect(parseSeats('5000000000x8')).toBeNull()
    })

    test('writes equal tables the short way', () => {
        expect(displaySeats([8, 8])).toBe('2x8')
        expect(displaySeats([10, 8])).toBe('10, 8')
    })

    test('keeps everyone on their side and spot when the tables change', () => {
        const plan = { tables: [[1, 2, 3, 4], [5]], unseated: [6] }
        expect(resizePlan(plan, [6])).toEqual({ tables: [[1, 2, null, 3, 4, null]], unseated: [6, 5] })
        expect(resizePlan(plan, [2])).toEqual({ tables: [[1, 3]], unseated: [6, 2, 4, 5] })
    })

    test('follows who is registered', () => {
        expect(reconcilePlan({ tables: [[1, 2]], unseated: [3] }, [2, 3, 4]))
            .toEqual({ tables: [[null, 2]], unseated: [3, 4] })
    })
})

describe('moving by hand', () => {
    const plan = { tables: [[1, 2], [3, null]], unseated: [4] }

    test('moves a guest to a seat and off the tables again', () => {
        expect(moveGuest(plan, 1, { table: 1, seat: 1 })).toEqual({ tables: [[null, 2], [3, 1]], unseated: [4] })
        expect(moveGuest(plan, 4, { table: 1, seat: 1 })).toEqual({ tables: [[1, 2], [3, 4]], unseated: [] })
        expect(moveGuest(plan, 3, null)).toEqual({ tables: [[1, 2], [null, null]], unseated: [4, 3] })
    })

    test('trades seats with whoever sits where a guest is moved', () => {
        expect(moveGuest(plan, 4, { table: 0, seat: 0 })).toEqual({ tables: [[4, 2], [3, null]], unseated: [1] })
        expect(swapGuests(plan, 1, 3)).toEqual({ tables: [[3, 2], [1, null]], unseated: [4] })
    })
})
