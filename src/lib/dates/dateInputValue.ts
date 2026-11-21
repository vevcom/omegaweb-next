/**
 * The value `DateInput` posts for a date: its date and time in UTC, to the minute, without a zone.
 * It is read back with `dateFromUtcInputValue`.
 */
export function utcInputValue(date: Date, includeTime: boolean) {
    return date.toISOString().substring(0, includeTime ? 16 : 10)
}

const dateTimeWithoutZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

/**
 * The date a value posted by `DateInput` stands for. A date and time that names no zone would be
 * read as local time, so it is read as UTC here, on the server as in the browser. A value that
 * names its zone is read in it.
 */
export function dateFromUtcInputValue(value: string) {
    // A date alone is read as UTC already.
    return new Date(dateTimeWithoutZone.test(value) ? `${value}Z` : value)
}
