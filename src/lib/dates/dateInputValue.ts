/**
 * The value `DateInput` posts for a date: its date and time in UTC, to the minute, without a zone.
 * The server runs in UTC and reads it as it stands.
 */
export function utcInputValue(date: Date, includeTime: boolean) {
    return date.toISOString().substring(0, includeTime ? 16 : 10)
}

/**
 * The date a value posted by `DateInput` stands for. A browser would read the value as local time,
 * since it names no zone, so the zone is given here.
 */
export function dateFromUtcInputValue(value: string) {
    // A date alone is read as UTC already.
    return new Date(value.includes('T') ? `${value}Z` : value)
}
