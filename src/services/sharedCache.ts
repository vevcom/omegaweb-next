import '@ow-server-only'
import { localCacheKey, WritesTold } from './localCache'
import { addSeenByAnAnswer, onTablesWritten, TablesSeen, watchTablesRead } from '@/prisma/tableWatch/watch'
import logger from '@/lib/logger'
import { AsyncLocalStorage } from 'async_hooks'
import { deserialize, serialize } from 'v8'
import type { Tables } from '@/prisma/tableWatch/tablesOfQuery'

/**
 * How many answers a `MapSharedCache` keeps before it drops the least recently used. An answer of
 * the reads shared today weighs 0.1 to 1.2 kB as JSON on the seeded database, a special cms image
 * or a standard image the most, so a full cache holds a few megabytes.
 */
export const SHARED_CACHE_SIZE = 1000

/**
 * How long an answer is given at most, from when its read began. Every write the watcher sees is
 * told to the cache, so it bounds what no watcher sees: a read whose answer changes with the clock,
 * and, for a cache in one process, a write in another.
 */
export const SHARED_CACHE_TIME_LIMIT_MS = 60 * 1000

type SharedCacheState = {
    cache?: SharedCache,
    stopListening?: () => void,
    notAReadRuns: AsyncLocalStorage<true>,
}

/** One for the process, hung on `globalThis`, as the watcher of the tables is. */
const stateKey = Symbol.for('omegaweb.sharedCache')
const processWide: typeof globalThis & { [stateKey]?: SharedCacheState } = globalThis
const state = processWide[stateKey] ??= { notAReadRuns: new AsyncLocalStorage() }

/**
 * What is remembered of the reads that say `shared` with their name, across requests. The process
 * begins one when it starts, `MapSharedCache.beginForProcess()` or `RedisSharedCache.beginForProcess(...)`,
 * and with none begun nothing is shared. No call sets it. A read asks it after its authorizer and
 * ownership check have run, so the session is not in its key, and a caller who may not read is
 * refused also when the answer is kept.
 *
 * An answer is kept under the read's name and what was asked, with the tables its read read, and is
 * given while none of them has been written, as in a local cache, and for at most
 * `SHARED_CACHE_TIME_LIMIT_MS`. Every write the watcher of the Prisma client tells of in the process
 * is told to it, wherever it was made. An answer that read no table, tables that cannot be told, or
 * another system, is not kept, nor one that is not plain data. What is kept is the answer
 * serialized, and every caller is given a copy of its own. What does not deserialize is a miss, so
 * no request fails on what is kept. Calls made while a read runs in the process share its run when
 * no write has been counted since it began. A failure is not kept, and a caller is not given
 * another's.
 *
 * A kind of cache says only how it is asked and where it keeps its answers and its count of writes.
 */
export abstract class SharedCache {
    private readonly underWay = new Map<string, AnswerUnderWay>()
    private readonly warnedOf = new Set<string>()

    /**
     * What is kept for this read and this key, and the count of writes now. `undefined` when the
     * cache cannot be asked, and the read is then read and not kept.
     */
    protected abstract ask(name: string, key: string): Promise<Asked | undefined> | Asked | undefined

    /** No answer that read one of the tables is given again. */
    public abstract tablesWritten(tables: Tables): void | Promise<void>

    /** Lets go of what the cache holds on to outside the process, once it is no longer in force. */
    public stop(): void {}

    public async remember<Answer>(
        name: string,
        key: string,
        read: () => Promise<SharedAnswer<Answer>>,
    ): Promise<SharedAnswer<Answer>> {
        const asked = await this.ask(name, key)
        if (!asked) return await read()
        if (asked.kept) {
            const kept = SharedAnswer.kept<Answer>(asked.kept.answer)
            if (kept) {
                addSeenByAnAnswer(seenOf(asked.kept.tables))
                return kept
            }
        }
        const id = `${name}:${key}`
        const underWay = this.underWay.get(id)
        if (underWay?.readAfter === asked.count) {
            const shared = await underWay.answer.then(answer => answer.serialized, () => undefined)
            addSeenByAnAnswer(underWay.seen)
            const joined = shared && SharedAnswer.kept<Answer>(shared)
            if (joined) return joined
        }
        return await this.readAndKeep(name, id, asked, read)
    }

    /** A new cache of this kind is the one of the process from now on, and the one before is let go. */
    public static beginForProcess<Args extends unknown[], Cache extends SharedCache>(
        this: new (...args: Args) => Cache,
        ...args: Args
    ): Cache {
        const cache = new this(...args)
        SharedCache.stopForProcess()
        state.stopListening = onTablesWritten(tables => cache.tablesWritten(tables))
        state.cache = cache
        return cache
    }

    /** No cache is the one of the process from now on, and the one that was is let go. */
    public static stopForProcess(): void {
        state.stopListening?.()
        state.cache?.stop()
        state.stopListening = undefined
        state.cache = undefined
    }

    /** The cache a read asks: the one of the process, unless something that is not a read runs. */
    public static inForce(): SharedCache | undefined {
        return state.notAReadRuns.getStore() ? undefined : state.cache
    }

    /** Runs the callback with no shared cache asked. What it writes is still told to the cache. */
    public static withNone<Result>(callback: () => Result): Result {
        return state.notAReadRuns.run(true, callback)
    }

    private async readAndKeep<Answer>(
        name: string,
        id: string,
        asked: Asked,
        read: () => Promise<SharedAnswer<Answer>>,
    ) {
        const readAt = Date.now()
        const { result, seen } = watchTablesRead(read)
        const underWay = { answer: result, readAfter: asked.count, seen }
        this.underWay.set(id, underWay)
        try {
            const answer = await result
            const tables = this.tablesToKeep(name, answer, seen)
            if (tables && answer.serialized) {
                await asked.keep({ answer: answer.serialized, readAfter: asked.count, readAt, tables })
            }
            return answer
        } finally {
            if (this.underWay.get(id) === underWay) this.underWay.delete(id)
            addSeenByAnAnswer(seen)
        }
    }

    private tablesToKeep(name: string, answer: SharedAnswer<unknown>, seen: TablesSeen) {
        if (seen.tables === 'unknown' || seen.readOutsideTheDatabase) return undefined
        if (answer.serialized) return Array.from(seen.tables)
        if (!this.warnedOf.has(name)) {
            this.warnedOf.add(name)
            logger.warn(
                `The shared read ${name} answered with what is not plain data, such as a class instance, so it is not kept.`
            )
        }
        return undefined
    }
}

/** What a cache has for a read when asked, and how to keep the answer of a read begun now. */
export type Asked = {
    /** How many writes the cache has counted. A read begun now keeps it as `readAfter`. */
    count: number,
    kept?: { answer: Buffer, tables: string[] },
    keep: (answer: KeptSharedAnswer) => void | Promise<void>,
}

export type KeptSharedAnswer = {
    answer: Buffer,
    /** The count of writes when its read began. */
    readAfter: number,
    readAt: number,
    tables: string[],
}

type AnswerUnderWay = {
    answer: Promise<SharedAnswer<unknown>>,
    readAfter: number,
    seen: TablesSeen,
}

/**
 * An answer as the shared cache keeps it: serialized, and given as a copy of its own to every
 * caller, also the one whose read it was, so no caller changes what the next is given. A `Date`
 * is given back as a `Date`. One that is not plain data does not survive it, and is given as it
 * is to the caller whose read it was alone. A kept one is deserialized once, as the copy of the
 * caller it is given to.
 */
export class SharedAnswer<Answer> {
    private constructor(private readonly held: { serialized: Buffer } | { answer: Answer }) {}

    /** What a local cache can key is plain data, which `serialize` keeps as it is. */
    public static of<Answer>(answer: Answer): SharedAnswer<Answer> {
        return new SharedAnswer(localCacheKey(answer) === undefined ? { answer } : { serialized: serialize(answer) })
    }

    /** `undefined` when what is kept does not deserialize, such as bytes of another V8 or a hand write. */
    public static kept<Answer>(serialized: Buffer): SharedAnswer<Answer> | undefined {
        try {
            return new SharedAnswer({ answer: new SharedAnswer<Answer>({ serialized }).given() })
        } catch {
            return undefined
        }
    }

    public get serialized(): Buffer | undefined {
        return 'serialized' in this.held ? this.held.serialized : undefined
    }

    public given(): Answer {
        if (!('serialized' in this.held)) return this.held.answer
        // What is kept under a read's name is that read's answer, which no type follows through the bytes.
        return deserialize(this.held.serialized) as Answer
    }
}

/**
 * Keeps its answers in a map of its own, in the memory of the process, at most
 * `SHARED_CACHE_SIZE` of them, and counts the writes told to it in the process.
 */
export class MapSharedCache extends SharedCache {
    private readonly kept = new Map<string, KeptSharedAnswer>()
    private readonly writes = new WritesTold()

    public tablesWritten(tables: Tables) {
        this.writes.tell(tables)
    }

    protected ask(name: string, key: string): Asked {
        const id = `${name}:${key}`
        const kept = this.usable(id)
        return {
            count: this.writes.count,
            kept,
            keep: answer => this.keep(id, answer),
        }
    }

    private usable(id: string) {
        const kept = this.kept.get(id)
        if (!kept) return undefined
        this.kept.delete(id)
        const isInTime = Date.now() - kept.readAt < SHARED_CACHE_TIME_LIMIT_MS
        const isUnwritten = this.writes.leaveUsable({ readAfter: kept.readAfter, seen: seenOf(kept.tables), hasEnded: true })
        if (!isInTime || !isUnwritten) return undefined
        // Put last again, as the most recently used.
        this.kept.set(id, kept)
        return kept
    }

    private keep(id: string, kept: KeptSharedAnswer) {
        this.kept.delete(id)
        this.kept.set(id, kept)
        // A map keeps the order things were put in, so the first is the least recently used.
        const leastRecentlyUsed = this.kept.keys().next()
        if (this.kept.size > SHARED_CACHE_SIZE && !leastRecentlyUsed.done) this.kept.delete(leastRecentlyUsed.value)
    }
}

function seenOf(tables: string[]) {
    const seen = new TablesSeen()
    seen.add(new Set(tables))
    return seen
}
