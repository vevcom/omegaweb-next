import { osloDateTime } from '@/lib/dates/oslo'

/** What is known about the registrations of a variant. It holds no names, so it can go to the client. */
export type VariantStatistics = {
    id: number,
    name: string,
    registrationStart: Date,
    places: number,
    /** When those still registered did so, waiting list included, from first to last. */
    registeredAt: Date[],
    inQuota: number,
    /** When the last of those in a quota registered. */
    lastSeatedAt: Date | null,
    waiting: number,
    /** Null when the variant takes no payment. */
    paid: number | null,
    attended: number,
}

export type RegistrationBucket = { start: Date, count: number }
export type BucketUnit = 'hour' | 'day' | 'week'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const MAX_DAYS_IN_HOURS = 2
const MAX_DAYS_IN_DAYS = 60

/**
 * The moment the last place was taken, or null while any is free. Those waiting do not count, since
 * someone may wait for a full quota while another they cannot join has places left.
 */
export function filledAt(
    { places, inQuota, lastSeatedAt }: Pick<VariantStatistics, 'places' | 'inQuota' | 'lastSeatedAt'>
): Date | null {
    return places > 0 && inQuota >= places ? lastSeatedAt : null
}

/** Null when the places have not been filled. An admin may register someone before it opens, which counts as at once. */
export function timeToFillMs(statistics: VariantStatistics): number | null {
    const filled = filledAt(statistics)
    return filled && Math.max(0, filled.getTime() - statistics.registrationStart.getTime())
}

/** Counts registrations per hour, day or week in Oslo time, whichever fits the period. Empty buckets are kept. */
export function registrationBuckets(
    { registrationStart, registeredAt }: Pick<VariantStatistics, 'registrationStart' | 'registeredAt'>
): { unit: BucketUnit, buckets: RegistrationBucket[] } {
    const first = Math.min(registrationStart.getTime(), registeredAt[0]?.getTime() ?? Infinity)
    const last = registeredAt[registeredAt.length - 1]?.getTime() ?? first
    const days = (last - first) / DAY_MS
    let unit: BucketUnit = 'week'
    if (days <= MAX_DAYS_IN_DAYS) unit = 'day'
    if (days <= MAX_DAYS_IN_HOURS) unit = 'hour'

    const buckets: RegistrationBucket[] = []
    let start = osloDateTime(new Date(first)).startOf(unit)
    let next = 0
    while (start.toMillis() <= last) {
        const end = start.plus({ [unit]: 1 })
        const bucketStart = next
        while (registeredAt[next] !== undefined && registeredAt[next].getTime() < end.toMillis()) next++
        buckets.push({ start: start.toJSDate(), count: next - bucketStart })
        start = end
    }
    return { unit, buckets }
}

export function displayDuration(ms: number): string {
    const minutes = Math.floor(ms / (60 * 1000))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    if (minutes === 0) return 'Under ett minutt'
    if (hours === 0) return `${minutes} min`
    if (days === 0) return `${hours} t ${minutes % 60} min`
    return `${days} d ${hours % 24} t`
}
