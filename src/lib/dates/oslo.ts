import { DateTime } from 'luxon'

/**
 * @returns `date`'s wall-clock fields (day, month, hour, ...) in Europe/Oslo, regardless of host timezone.
 */
export function osloDateTime(date: Date): DateTime {
    return DateTime.fromJSDate(date).setZone('Europe/Oslo')
}

/**
 * @returns the instants a calendar year in Europe/Oslo runs between, as a Prisma date filter: from
 * its first moment, up to but not including the first moment of the next year.
 */
export function osloYearInterval(year: number): { gte: Date, lt: Date } {
    const start = DateTime.fromObject({ year }, { zone: 'Europe/Oslo' })
    return { gte: start.toJSDate(), lt: start.plus({ years: 1 }).toJSDate() }
}
