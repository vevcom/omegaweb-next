import { DateTime } from 'luxon'

/**
 * @returns `date`'s wall-clock fields (day, month, hour, ...) in Europe/Oslo, regardless of host timezone.
 */
export function osloDateTime(date: Date): DateTime {
    return DateTime.fromJSDate(date).setZone('Europe/Oslo')
}
