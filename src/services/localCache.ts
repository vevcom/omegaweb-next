import '@ow-server-only'
import { addSeenByAnAnswer, onTablesWritten, watchTablesRead } from '@/prisma/tableWatch/watch'
import { AsyncLocalStorage } from 'async_hooks'
import type { Tables } from '@/prisma/tableWatch/tablesOfQuery'
import type { TablesSeen } from '@/prisma/tableWatch/watch'

/** `isAsked` is false while something that is not a read runs: the cache is told and not asked. */
const cacheInForce = new AsyncLocalStorage<{ cache: LocalCache, isAsked: boolean } | undefined>()

onTablesWritten(tables => cacheInForce.getStore()?.cache.tablesWritten(tables))

/**
 * What is remembered of the calls made while it is in force. A caller begins one around a callback,
 * `MapLocalCache.begin(() => ...)`, and it is in force for everything that callback runs. It is not
 * part of the service context, so no call sets it. Only an operation that says `read: true` asks
 * it, so a read that many callers make runs once.
 *
 * An answer is kept with the tables its read read, which the watcher of the Prisma client names,
 * and is given for as long as none of them has been written. An answer that read no table, or
 * tables that cannot be told, or that asked for a read that read none, is given until anything that
 * is not a read has ended or anything is written.
 *
 * One begun inside another is the one in force there, and the only one a read inside it asks. What
 * is written inside it is told to it and to every one it was begun inside of, since their answers
 * may be from before the write too.
 */
export abstract class LocalCache {
    private upstream: LocalCache | undefined

    /**
     * Where the answer for this operation and this key is kept: the same place every time it is
     * asked for, for as long as this kind of cache remembers.
     */
    protected abstract placeOf(operation: object, key: string): LocalCachePlace
    /** The writes told to this cache, which are kept for as long as its answers. */
    protected abstract writes(): WritesTold

    /**
     * The answer kept for this operation and this key, or `read` run and its answer kept. What is
     * kept is the promise, so calls made at the same time share one run, and a call that throws is
     * remembered as well: a refusal, and also a failure that would have passed on a second try.
     * The tables of the answer are added to the read that asked for it, so a read that calls a read
     * has the tables of both. `read` awaits what it reads, see {@link watchTablesRead}.
     */
    public remember(operation: object, key: string, read: () => Promise<unknown>): Promise<unknown> {
        const place = this.placeOf(operation, key)
        const writes = this.writes()
        const kept = place.kept && writes.leaveUsable(place.kept) ? place.kept : keep(read, writes.count)
        place.kept = kept

        // Added before the caller goes on, who is handed the answer after this.
        const addToTheReadThatAsked = () => addSeenByAnAnswer(kept.seen)
        void kept.answer.then(addToTheReadThatAsked, addToTheReadThatAsked)
        return kept.answer
    }

    /** No answer that read one of the tables is given again, here and in every cache upstream. */
    public tablesWritten(tables: Tables): void {
        this.writes().tell(tables)
        this.upstream?.tablesWritten(tables)
    }

    /**
     * Something that is not a read has ended. What it wrote to the database the watcher has told
     * of, and what it may have written elsewhere no table shows. So no answer that may have read
     * outside the database, or tables that cannot be told, is given again, here and in every cache
     * upstream.
     */
    public notAReadEnded(): void {
        this.writes().tell(new Set())
        this.upstream?.notAReadEnded()
    }

    /** Runs the callback with a new cache of this kind in force. */
    public static begin<Result>(this: new () => LocalCache, callback: () => Result): Result {
        const cache = new this()
        cache.upstream = cacheInForce.getStore()?.cache
        return cacheInForce.run({ cache, isAsked: true }, callback)
    }

    /** The cache a read asks. */
    public static inForce(): LocalCache | undefined {
        const inForce = cacheInForce.getStore()
        return inForce?.isAsked ? inForce.cache : undefined
    }

    /**
     * Runs the callback with no cache asked, so what it reads is read fresh and never kept. What it
     * writes is still told to the cache that was in force.
     */
    public static withNone<Result>(callback: () => Result): Result {
        const inForce = cacheInForce.getStore()
        return cacheInForce.run(inForce && { cache: inForce.cache, isAsked: false }, callback)
    }
}

type KeptAnswer = {
    answer: Promise<unknown>,
    /** How many writes the cache had been told of when the read began. */
    readAfter: number,
    /** The tables the read has read, which is all of them once it has ended. */
    seen: TablesSeen,
    hasEnded: boolean,
}

export type LocalCachePlace = { kept?: KeptAnswer }

/**
 * The writes a cache has been told of. They are counted, and a table keeps the count at the last
 * write to it. An answer keeps the count from when its read began, and is given while none of its
 * tables has been written since. So nothing is emptied at a write, and a write that ends while a
 * read is under way makes its answer unusable though the read began first.
 */
export class WritesTold {
    private told = 0
    private readonly lastToTable = new Map<string, number>()
    private lastToUnknownTables = 0

    public get count() {
        return this.told
    }

    public tell(tables: Tables) {
        this.told++
        if (tables === 'unknown') {
            this.lastToUnknownTables = this.told
            return
        }
        tables.forEach(table => this.lastToTable.set(table, this.told))
    }

    public leaveUsable({ readAfter, seen, hasEnded }: KeptAnswer) {
        const { tables } = seen
        if (this.told === readAfter) return true
        if (!hasEnded || tables === 'unknown' || seen.readOutsideTheDatabase) return false
        if (this.lastToUnknownTables > readAfter) return false
        return Array.from(tables).every(table => (this.lastToTable.get(table) ?? 0) <= readAfter)
    }
}

function keep(read: () => Promise<unknown>, readAfter: number): KeptAnswer {
    const { result: answer, seen } = watchTablesRead(read)
    const kept: KeptAnswer = { answer, readAfter, seen, hasEnded: false }
    const ended = () => {
        kept.hasEnded = true
    }
    void answer.then(ended, ended)
    return kept
}

/** Keeps its answers in a map of its own, so they live for the callback it was begun around. */
export class MapLocalCache extends LocalCache {
    private readonly places = new Map<object, Map<string, LocalCachePlace>>()
    private readonly writesTold = new WritesTold()

    protected placeOf(operation: object, key: string) {
        const placesOfOperation = this.places.get(operation) ?? new Map<string, LocalCachePlace>()
        this.places.set(operation, placesOfOperation)
        const place = placesOfOperation.get(key) ?? {}
        placesOfOperation.set(key, place)
        return place
    }

    protected writes() {
        return this.writesTold
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
