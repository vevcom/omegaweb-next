import '@ow-server-only'
import { AsyncLocalStorage } from 'async_hooks'

const cacheInForce = new AsyncLocalStorage<LocalCache | undefined>()

/**
 * What is remembered of the calls made while it is in force. A caller begins one around a callback,
 * `MapLocalCache.begin(() => ...)`, and it is in force for everything that callback runs. It is not
 * part of the service context, so no call sets it. Only an operation that says `read: true` asks
 * it, so a read that many callers make runs once. Every other operation may write, so it clears the
 * cache in force when it ends, and what is read after it is read again.
 *
 * One begun inside another is the one in force there, and the only one a read inside it asks. A
 * write inside it clears it and every one it was begun inside of, since their answers may be from
 * before the write too.
 */
export abstract class LocalCache {
    private upstream: LocalCache | undefined

    /**
     * The answer kept for this operation and this key, or `read` run and its answer kept. What is
     * kept is the promise, so calls made at the same time share one run, and a call that throws is
     * remembered as well: a refusal, and also a failure that would have passed on a second try.
     */
    public abstract remember(operation: object, key: string, read: () => Promise<unknown>): Promise<unknown>
    /** Forgets every answer of this cache alone. */
    protected abstract clearOwn(): void

    /** Forgets every answer, here and in every cache this one was begun inside of. */
    public clear(): void {
        this.clearOwn()
        this.upstream?.clear()
    }

    /** Runs the callback with a new cache of this kind in force. */
    public static begin<Result>(this: new () => LocalCache, callback: () => Result): Result {
        const cache = new this()
        cache.upstream = cacheInForce.getStore()
        return cacheInForce.run(cache, callback)
    }

    public static inForce(): LocalCache | undefined {
        return cacheInForce.getStore()
    }

    /** Runs the callback with no cache in force, so what it reads is read fresh and never kept. */
    public static withNone<Result>(callback: () => Result): Result {
        return cacheInForce.run(undefined, callback)
    }
}

/** Keeps its answers in a map of its own, so they live for the callback it was begun around. */
export class MapLocalCache extends LocalCache {
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

    protected clearOwn() {
        this.answers.clear()
    }
}

/**
 * The key of a value: the same string for two values exactly when they are equal by value, whatever
 * objects they are and whatever order their fields were written in. A value that cannot be compared
 * so, such as a class instance, a function, an object with a symbol for a field or one that holds
 * itself, has no key, and a call with one is not remembered.
 */
export function localCacheKey(value: unknown): string | undefined {
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
