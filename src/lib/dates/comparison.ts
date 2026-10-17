
export function getWeekNumber(date: Date): number {
    const tempDate = new Date(date.valueOf())
    const dayNum = (date.getUTCDay() + 6) % 7
    tempDate.setUTCDate(tempDate.getUTCDate() - dayNum + 3)
    const firstThursday = tempDate.valueOf()
    tempDate.setUTCMonth(0, 1)
    if (tempDate.getUTCDay() !== 4) {
        tempDate.setUTCMonth(0, 1 + ((4 - tempDate.getUTCDay()) + 7) % 7)
    }
    return 1 + Math.ceil((firstThursday - tempDate.valueOf()) / 604800000)
}

export function datesEqual(lhs?: Date, rhs?: Date) {
    if (!lhs && !rhs) return true
    if (!lhs || !rhs) return false
    return lhs.getUTCFullYear() === rhs.getUTCFullYear()
        && lhs.getUTCMonth() === rhs.getUTCMonth()
        && lhs.getUTCDate() === rhs.getUTCDate()
}

export function dateLessThan(lhs: Date, rhs: Date) {
    if (lhs.getUTCFullYear() < rhs.getUTCFullYear()) return true
    if (lhs.getUTCFullYear() > rhs.getUTCFullYear()) return false

    if (lhs.getUTCMonth() < rhs.getUTCMonth()) return true
    if (lhs.getUTCMonth() > rhs.getUTCMonth()) return false

    if (lhs.getUTCDate() < rhs.getUTCDate()) return true
    return false
}

export function dateLessThanOrEqualTo(lhs: Date, rhs: Date) {
    return datesEqual(lhs, rhs) || dateLessThan(lhs, rhs)
}

/**
 * Test if a date is in the interval [start, end>
 * @param date - The date to test
 * @param start - The start of the interval
 * @param end - The end of the interval
 * @param startInclusive - If the start of the interval is inclusive, default true
 * @param endInclusive - If the end of the interval is inclusive, default false
 * @returns boolean
 */
export function dateInInterval(date: Date, start: Date, end: Date, startInclusive = true, endInclusive = false) {
    const startCmp = startInclusive ? dateLessThanOrEqualTo : dateLessThan
    const endCmp = endInclusive ? dateLessThanOrEqualTo : dateLessThan
    return startCmp(start, date) && endCmp(date, end)
}
