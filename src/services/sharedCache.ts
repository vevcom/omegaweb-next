import '@ow-server-only'
import { localCacheKey, WritesTold } from './localCache'
import { addSeenByAnAnswer, onTablesWritten, watchTablesRead } from '@/prisma/tableWatch/watch'
import logger from '@/lib/logger'
import { AsyncLocalStorage } from 'async_hooks'
import type { Tables } from '@/prisma/tableWatch/tablesOfQuery'
import type { TablesSeen } from '@/prisma/tableWatch/watch'

/**
 * How many answers a `MapSharedCache` keeps before it drops the least recently used. An answer of
 * the reads shared today weighs 0.1 to 1.2 kB as JSON on the seeded database, a special cms image
 * or a standard image the most, so a full cache holds a few megabytes.
 */
export const SHARED_CACHE_SIZE = 1000

/**
 * How long an answer is given at most, from when its read began. It bounds what no watcher in this
 * process sees: a write in the worker or in another process of the app, and a read whose answer
 * changes with the clock.
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
 * What is remembered of the reads that say `shared: true`, across requests. The process begins one
 * when it starts, `MapSharedCache.beginForProcess()`, and with none begun nothing is shared. No call
 * sets it. A read asks it after its authorizer and ownership check have run, so the session is not
 * in its key, and a caller who may not read is refused also when the answer is kept.
 *
 * An answer is kept with the tables its read read, and is given while none of them has been
 * written, as in a local cache, and for at most `SHARED_CACHE_TIME_LIMIT_MS`. Every write the
 * watcher of the Prisma client tells of in the process is told to it, wherever it was made. An
 * answer that read no table, tables that cannot be told, or another system, is not kept, nor one
 * that is not plain data. What is kept is the data, and every caller is given a copy of its own.
 */
export abstract class SharedCache {
    /**
     * The answer kept for this operation and this key, or `read` run and its answer kept when it
     * may be. The tables of the answer are added to the read that asked for it. A failure is not
     * kept, and a caller is not given another's.
     */
    public abstract remember(
        operation: object,
        key: string,
        read: () => Promise<SharedAnswer<unknown>>,
    ): Promise<SharedAnswer<unknown>>

    /** No answer that read one of the tables is given again. */
    public abstract tablesWritten(tables: Tables): void

    /** A new cache of this kind is the one of the process from now on. */
    public static beginForProcess(this: new () => SharedCache): void {
        const cache = new this()
        state.stopListening?.()
        state.stopListening = onTablesWritten(tables => cache.tablesWritten(tables))
        state.cache = cache
    }

    /** The cache a read asks: the one of the process, unless something that is not a read runs. */
    public static inForce(): SharedCache | undefined {
        return state.notAReadRuns.getStore() ? undefined : state.cache
    }

    /** Runs the callback with no shared cache asked. What it writes is still told to the cache. */
    public static withNone<Result>(callback: () => Result): Result {
        return state.notAReadRuns.run(true, callback)
    }
}

/**
 * An answer as the shared cache keeps it. It is given as a copy of its own to every caller, also
 * the one whose read it was, so no caller changes what the next is given. One that is not plain
 * data cannot be copied so, and is given as it is.
 */
export class SharedAnswer<Answer> {
    public readonly isPlainData: boolean

    public constructor(private readonly answer: Answer) {
        // What a local cache can key is plain data, which `structuredClone` copies as it is.
        this.isPlainData = localCacheKey(answer) !== undefined
    }

    public given(): Answer {
        return this.isPlainData ? structuredClone(this.answer) : this.answer
    }
}

type KeptSharedAnswer = {
    answer: SharedAnswer<unknown>,
    readAfter: number,
    seen: TablesSeen,
    readAt: number,
}

type SharedAnswerUnderWay = Omit<KeptSharedAnswer, 'answer' | 'readAt'> & { answer: Promise<SharedAnswer<unknown>> }

/**
 * Keeps its answers in a map of its own, in the memory of the process, at most
 * `SHARED_CACHE_SIZE` of them. A read under way is shared by the calls made while it runs.
 */
export class MapSharedCache extends SharedCache {
    private readonly kept = new Map<string, KeptSharedAnswer>()
    private readonly underWay = new Map<string, SharedAnswerUnderWay>()
    private readonly writes = new WritesTold()
    private readonly idOfOperation = new WeakMap<object, number>()
    private operationsSeen = 0
    private readonly warnedOf = new WeakSet<object>()

    public async remember(operation: object, key: string, read: () => Promise<SharedAnswer<unknown>>) {
        const id = `${this.idOf(operation)}:${key}`
        const kept = this.usable(id)
        if (kept) {
            addSeenByAnAnswer(kept.seen)
            return kept.answer
        }
        const underWay = this.underWay.get(id)
        if (underWay?.readAfter === this.writes.count) {
            try {
                return await underWay.answer
            } catch {
                return await this.readAndKeep(operation, id, read)
            } finally {
                addSeenByAnAnswer(underWay.seen)
            }
        }
        return await this.readAndKeep(operation, id, read)
    }

    public tablesWritten(tables: Tables) {
        this.writes.tell(tables)
    }

    private async readAndKeep(operation: object, id: string, read: () => Promise<SharedAnswer<unknown>>) {
        const readAt = Date.now()
        const { result, seen } = watchTablesRead(read)
        const underWay = { answer: result, readAfter: this.writes.count, seen }
        this.underWay.set(id, underWay)
        try {
            const answer = await result
            if (this.mayKeep(operation, answer, seen)) this.keep(id, { ...underWay, answer, readAt })
            return answer
        } finally {
            if (this.underWay.get(id) === underWay) this.underWay.delete(id)
            addSeenByAnAnswer(seen)
        }
    }

    private usable(id: string) {
        const kept = this.kept.get(id)
        if (!kept) return undefined
        this.kept.delete(id)
        const isInTime = Date.now() - kept.readAt < SHARED_CACHE_TIME_LIMIT_MS
        if (!isInTime || !this.writes.leaveUsable({ ...kept, hasEnded: true })) return undefined
        // Put last again, as the most recently used.
        this.kept.set(id, kept)
        return kept
    }

    private mayKeep(operation: object, answer: SharedAnswer<unknown>, seen: TablesSeen) {
        if (seen.tables === 'unknown' || seen.readOutsideTheDatabase) return false
        if (answer.isPlainData) return true
        if (!this.warnedOf.has(operation)) {
            this.warnedOf.add(operation)
            logger.warn('A shared read answered with what is not plain data, such as a class instance, so it is not shared.')
        }
        return false
    }

    private keep(id: string, kept: KeptSharedAnswer) {
        this.kept.delete(id)
        this.kept.set(id, kept)
        // A map keeps the order things were put in, so the first is the least recently used.
        const leastRecentlyUsed = this.kept.keys().next()
        if (this.kept.size > SHARED_CACHE_SIZE && !leastRecentlyUsed.done) this.kept.delete(leastRecentlyUsed.value)
    }

    private idOf(operation: object) {
        const id = this.idOfOperation.get(operation) ?? ++this.operationsSeen
        this.idOfOperation.set(operation, id)
        return id
    }
}
