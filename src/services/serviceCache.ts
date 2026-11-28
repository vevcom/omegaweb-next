import '@ow-server-only'

/**
 * What a service context remembers of the calls made in it. Only an operation that says
 * `read: true` asks it, so a read that many callers make in one context runs once. Every other
 * operation may write, so it clears the cache when it ends, and what is read after it is read
 * again. Whoever opens a context hands it its cache, and so decides how long an answer lives.
 */
export type ServiceCache = {
    /**
     * The answer kept for this operation and this key, or `read` run and its answer kept. What is
     * kept is the promise, so calls made at the same time share one run, and a call that throws is
     * remembered as well: a refusal, and also a failure that would have passed on a second try.
     */
    remember(operation: object, key: string, read: () => Promise<unknown>): Promise<unknown>
    /** Forgets every answer, since something that may have written has run. */
    clear(): void
}

/** Keeps its answers in a map of its own, so it lives for as long as whoever made it keeps it. */
export class MapServiceCache implements ServiceCache {
    private readonly answers = new Map<object, Map<string, Promise<unknown>>>()

    public remember(operation: object, key: string, read: () => Promise<unknown>) {
        const answersOfOperation = this.answers.get(operation) ?? new Map<string, Promise<unknown>>()
        this.answers.set(operation, answersOfOperation)

        const kept = answersOfOperation.get(key)
        if (kept) return kept

        const answer = read()
        answersOfOperation.set(key, answer)
        return answer
    }

    public clear() {
        this.answers.clear()
    }
}

/** Remembers nothing. It is what a context has when it is handed no cache, and inside a transaction. */
export class NoServiceCache implements ServiceCache {
    public remember(operation: object, key: string, read: () => Promise<unknown>) {
        return read()
    }

    public clear() {}
}

/**
 * The key of a value: the same string for two values exactly when they are equal by value, whatever
 * objects they are and whatever order their fields were written in. A value that cannot be compared
 * so, such as a class instance, a function, an object with a symbol for a field or one that holds
 * itself, has no key, and a call with one is not remembered.
 */
export function serviceCacheKey(value: unknown): string | undefined {
    return keyOf(value, [])
}

// `within` is the objects the value is inside of, so one that holds itself is found and not followed.
function keyOf(value: unknown, within: object[]): string | undefined {
    if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
        return String(value)
    }
    if (typeof value === 'string') return JSON.stringify(value)
    if (typeof value === 'bigint') return `${value}n`
    if (typeof value !== 'object' || within.includes(value)) return undefined
    if (value instanceof Date) return `Date(${value.getTime()})`
    const keyOfPart = (part: unknown) => keyOf(part, [...within, value])
    if (Array.isArray(value)) return keyOfParts('[', value.map(keyOfPart), ']')
    if (Reflect.getPrototypeOf(value) === Object.prototype && !Object.getOwnPropertySymbols(value).length) {
        const fields = Object.entries(value).sort(([name], [other]) => (name < other ? -1 : 1))
        return keyOfParts('{', fields.map(([name, field]) => keyOfField(name, keyOfPart(field))), '}')
    }
    return undefined
}

function keyOfField(name: string, key: string | undefined) {
    return key === undefined ? undefined : `${JSON.stringify(name)}:${key}`
}

function keyOfParts(opening: string, parts: (string | undefined)[], closing: string) {
    return parts.includes(undefined) ? undefined : `${opening}${parts.join(',')}${closing}`
}
