import { displayDuration, filledAt, registrationBuckets, timeToFillMs } from '@/services/events/statistics'
import { describe, expect, test } from '@jest/globals'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const start = new Date('2026-03-10T11:00:00Z')
const after = (ms: number) => new Date(start.getTime() + ms)

const statistics = (places: number, registeredAt: Date[], inQuota = Math.min(places, registeredAt.length)) => ({
    id: 1,
    name: 'Påmelding',
    registrationStart: start,
    places,
    registeredAt,
    inQuota,
    lastSeatedAt: registeredAt[inQuota - 1] ?? null,
    waiting: 0,
    paid: null,
    attended: 0,
})

describe('time to fill', () => {
    test('is the time until the last place went', () => {
        const stats = statistics(2, [after(MINUTE), after(5 * MINUTE), after(9 * MINUTE)])
        expect(filledAt(stats)).toEqual(after(5 * MINUTE))
        expect(timeToFillMs(stats)).toBe(5 * MINUTE)
    })

    test('is unknown until every place is taken, and without places', () => {
        expect(timeToFillMs(statistics(2, [after(MINUTE)]))).toBeNull()
        expect(timeToFillMs(statistics(0, [after(MINUTE)]))).toBeNull()
    })

    test('is not full while someone waits for a quota and another has places left', () => {
        expect(timeToFillMs(statistics(2, [after(MINUTE), after(2 * MINUTE)], 1))).toBeNull()
    })

    test('counts as at once when an admin registered people before it opened', () => {
        expect(timeToFillMs(statistics(1, [after(-HOUR)]))).toBe(0)
    })
})

describe('registrationBuckets', () => {
    const count = (registeredAt: Date[]) => registrationBuckets({ registrationStart: start, registeredAt })

    test('counts per hour over a short period and keeps empty hours', () => {
        const { unit, buckets } = count([after(MINUTE), after(2 * MINUTE), after(2 * HOUR)])
        expect(unit).toBe('hour')
        expect(buckets.map(bucket => bucket.count)).toEqual([2, 0, 1])
    })

    test('counts per day and per week over longer periods', () => {
        expect(count([after(MINUTE), after(10 * DAY)]).unit).toBe('day')
        expect(count([after(MINUTE), after(100 * DAY)]).unit).toBe('week')
    })

    test('starts days at midnight in Oslo, not in UTC', () => {
        const { buckets } = count([after(MINUTE), after(10 * DAY)])
        expect(buckets[0].start.toISOString()).toBe('2026-03-09T23:00:00.000Z')
    })

    test('loses nobody over a change to summer time', () => {
        const dates = [0, 1, 2, 3, 4, 5].map(index => after((15 + index) * DAY))
        const { buckets } = count(dates)
        expect(buckets.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(dates.length)
    })

    test('has a bucket for a period with no registrations', () => {
        expect(count([]).buckets).toHaveLength(1)
    })
})

describe('displayDuration', () => {
    test.each([
        [30 * 1000, 'Under ett minutt'],
        [12 * MINUTE, '12 min'],
        [2 * HOUR + 5 * MINUTE, '2 t 5 min'],
        [3 * DAY + 4 * HOUR, '3 d 4 t'],
    ])('shows %d ms as %s', (ms, shown) => {
        expect(displayDuration(ms)).toBe(shown)
    })
})
