/**
 * The fields of `given` that differ from what `current` holds, for a save that writes only what
 * changed. A field given as undefined is not given, and dates are compared as the instants they are.
 */
export function changedFields<Given extends Record<string, unknown>>(
    current: Record<string, unknown>,
    given: Given,
): Partial<Given> {
    const same = (one: unknown, other: unknown) => (
        one instanceof Date && other instanceof Date ? one.getTime() === other.getTime() : one === other
    )
    // The entries kept are entries of `given`, so they make up a part of it.
    return Object.fromEntries(
        Object.entries(given).filter(([key, value]) => value !== undefined && !same(current[key], value))
    ) as Partial<Given>
}
