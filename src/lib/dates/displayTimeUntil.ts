import { osloDateTime } from './oslo'

/**
 * How long until `date`, in Norwegian and counted in Oslo calendar days: "i dag kl. 12:00",
 * "i morgen kl. 12:00" or "om 3 dager".
 */
export function displayTimeUntil(date: Date, now: Date): string {
    const then = osloDateTime(date)
    const daysUntil = Math.round(then.startOf('day').diff(osloDateTime(now).startOf('day'), 'days').days)
    const clock = then.toFormat('HH:mm')
    if (daysUntil <= 0) return `i dag kl. ${clock}`
    if (daysUntil === 1) return `i morgen kl. ${clock}`
    return `om ${daysUntil} dager`
}
