import '@ow-server-only'
import { SHARED_CACHE_TIME_LIMIT_MS, SharedCache } from './sharedCache'
import logger from '@/lib/logger'
import { createClient, ErrorReply, RESP_TYPES } from '@redis/client'
import { createHash } from 'crypto'
import type { Asked, KeptSharedAnswer } from './sharedCache'
import type { Tables } from '@/prisma/tableWatch/tablesOfQuery'

/** How long a request waits for Redis at most, before it reads from the database instead. */
export const SHARED_CACHE_REDIS_TIMEOUT_MS = 250

/** How long after a command fails the cache asks Redis again, when the connection itself holds. */
const RETRY_MS = 1000

// The .env.default placeholder for unfilled-in secrets, treated the same as unset.
const UNSET_PLACEHOLDER = '<INSERT>'

/** The Redis the shared cache is kept in. Left unset, the app keeps one in each process and the worker none. */
export const redisUrl = envValue('REDIS_URL')

type Script = { lua: string, sha: string }

/**
 * Whether an answer is usable, by the rule of `WritesTold`: no write since its read began, or none
 * since to tables that cannot be told nor to one of its tables. One whose count is past the count now
 * was counted on what Redis has lost since, such as by an eviction or a hand `DEL`.
 */
const usable = `
local function usable(writes, count, readAfter, tables)
    if readAfter > count then return false end
    if count == readAfter then return true end
    if tonumber(redis.call('HGET', writes, 'unknown') or 0) > readAfter then return false end
    for name in string.gmatch(tables, '[^,]+') do
        if tonumber(redis.call('HGET', writes, 'table:' .. name) or 0) > readAfter then return false end
    end
    return true
end
local count = tonumber(redis.call('HGET', KEYS[1], 'count') or 0)
`

/** The count, and the tables and the answer when one is kept and usable. One that is not is deleted. */
const askScript = scriptOf(`${usable}
local kept = redis.call('HMGET', KEYS[2], 'readAfter', 'readAt', 'tables', 'answer')
if not kept[1] then return { count } end
local isInTime = tonumber(ARGV[1]) - tonumber(kept[2]) < tonumber(ARGV[2])
if isInTime and usable(KEYS[1], count, tonumber(kept[1]), kept[3]) then return { count, kept[3], kept[4] } end
redis.call('DEL', KEYS[2])
return { count }
`)

/** Keeps an answer, unless it is unusable already. */
const keepScript = scriptOf(`${usable}
if not usable(KEYS[1], count, tonumber(ARGV[1]), ARGV[3]) then return 0 end
redis.call('HSET', KEYS[2], 'readAfter', ARGV[1], 'readAt', ARGV[2], 'tables', ARGV[3], 'answer', ARGV[4])
redis.call('PEXPIRE', KEYS[2], ARGV[5])
return 1
`)

/** Counts a write, and keeps the count at it for each of its tables, or for tables that cannot be told. */
const tellScript = scriptOf(`
local count = redis.call('HINCRBY', KEYS[1], 'count', 1)
if ARGV[1] == 'unknown' then
    redis.call('HSET', KEYS[1], 'unknown', count)
else
    for i = 2, #ARGV do redis.call('HSET', KEYS[1], 'table:' .. ARGV[i], count) end
end
return count
`)

/**
 * Keeps the answers and the count of writes in Redis, so every process that begins one shares one
 * cache: an answer read in one is given in all, and a write in one is counted for all at once. Every
 * key has `namespace` as its hash tag, so all of them are on one node of a cluster, as the scripts
 * need. An answer is kept under `version` as well, the build that read it, so a process of another
 * build is never given an answer of another shape. The count is kept by every build alike. A process
 * with no version, such as the worker, only tells of its writes, and neither asks nor keeps.
 *
 * The writes are counted in one hash with no expiry: the count, the count at the last write to each
 * table, and at the last write to tables that cannot be told. An answer is a hash of its own, with
 * the count from when its read began, when that was, its tables and the answer, and expires at the
 * time limit. So Redis's `maxmemory` with `volatile-lru` drops answers, the least recently used
 * first, and never the count they are judged by. A write is told in one script, and an answer asked
 * for in one, which also gives the count a read begun now keeps. A script runs alone, so a write
 * whose count is taken after an answer's read began makes the answer unusable, whichever process
 * kept it and when.
 *
 * Redis away, or slower than `SHARED_CACHE_REDIS_TIMEOUT_MS`, is logged once, and the cache is then
 * neither asked nor told until it answers again, so what is read goes to the database and no request
 * waits for it. A write it was not told of, by this process or by any while Redis lost what it held,
 * is not seen by anyone. So before it is asked again after a write it missed, and on every new
 * connection, it is told of a write to tables that cannot be told, which makes every answer kept so
 * far unusable.
 */
export class RedisSharedCache extends SharedCache {
    private readonly client
    private readonly keys
    /** Asked and told: connected, and told of every write made here, or of one that covers them. */
    private isReady = false
    private wasAway = false
    private hasMissedWrites = false
    private recovery: Promise<void> | undefined
    private connections = 0
    /** The connection a write to tables that cannot be told was last told on. */
    private toldOn = 0
    private readonly ready: Promise<void>
    private becameReady = () => {}

    public constructor(url: string, private readonly version: string | null, namespace = 'omegaweb') {
        super()
        this.keys = {
            writes: `{${namespace}}:writes`,
            answer: (name: string, key: string) => `{${namespace}}:answer:${version}:${name}:${hashOf(key)}`,
        }
        this.ready = new Promise(resolve => {
            this.becameReady = resolve
        })
        this.client = createClient({
            url,
            disableOfflineQueue: true,
            commandOptions: { typeMapping: { [RESP_TYPES.BLOB_STRING]: Buffer } },
        })
        this.client.on('error', (error: unknown) => this.away(error))
        this.client.on('ready', () => {
            this.connections++
            void this.recover()
        })
        this.client.connect().catch((error: unknown) => this.away(error))
    }

    public async tablesWritten(tables: Tables) {
        if (!this.isReady) {
            this.hasMissedWrites = true
            return
        }
        await this.tell(tables).catch((error: unknown) => {
            this.hasMissedWrites = true
            this.away(error)
        })
    }

    /** Resolves once the cache is first asked and told. */
    public whenReady(): Promise<void> {
        return this.ready
    }

    protected async ask(name: string, key: string): Promise<Asked | undefined> {
        if (!this.isReady || this.version === null) return undefined
        const answerKey = this.keys.answer(name, key)
        const connection = this.connections
        const reply = await this.run(this.send(askScript, [this.keys.writes, answerKey], [
            String(Date.now()), String(SHARED_CACHE_TIME_LIMIT_MS),
        ])).catch((error: unknown) => {
            this.away(error)
            return undefined
        })
        if (!Array.isArray(reply) || typeof reply[0] !== 'number') return undefined
        const [count, tables, answer] = reply
        return {
            count,
            kept: Buffer.isBuffer(tables) && Buffer.isBuffer(answer)
                ? { answer, tables: tables.toString().split(',') }
                : undefined,
            keep: kept => this.keep(answerKey, kept, connection),
        }
    }

    public stop() {
        this.client.destroy()
    }

    // A read begun on an earlier connection may have been counted on what Redis has since lost.
    private async keep(answerKey: string, kept: KeptSharedAnswer, connection: number) {
        if (!this.isReady || connection !== this.connections) return
        const expiresIn = SHARED_CACHE_TIME_LIMIT_MS - (Date.now() - kept.readAt)
        if (expiresIn <= 0) return
        await this.run(this.send(keepScript, [this.keys.writes, answerKey], [
            String(kept.readAfter), String(kept.readAt), kept.tables.join(','), kept.answer, String(expiresIn),
        ])).catch((error: unknown) => this.away(error))
    }

    private tell(tables: Tables) {
        const told = tables === 'unknown' ? ['unknown'] : ['tables', ...Array.from(tables)]
        return this.run(this.send(tellScript, [this.keys.writes], told))
    }

    private away(error: unknown) {
        this.isReady = false
        if (!this.wasAway) {
            this.wasAway = true
            logger.warn(`The shared cache in Redis is away, so reads go to the database until it is back: ${error}`)
        }
        // The client tries again by itself when the connection is lost, and only then.
        if (this.client.isReady) setTimeout(() => void this.recover(), RETRY_MS).unref()
    }

    private recover() {
        this.recovery ??= (async () => {
            try {
                // A command that timed out missed no write, so Redis need only answer.
                if (this.toldOn === this.connections && !this.hasMissedWrites) await this.run(this.client.ping())
                while (this.toldOn !== this.connections || this.hasMissedWrites) {
                    const connection = this.connections
                    this.hasMissedWrites = false
                    await this.tell('unknown').catch((error: unknown) => {
                        this.hasMissedWrites = true
                        throw error
                    })
                    this.toldOn = connection
                }
                this.isReady = true
                this.becameReady()
                if (this.wasAway) logger.info('The shared cache in Redis is back.')
                this.wasAway = false
            } catch (error) {
                this.away(error)
            } finally {
                this.recovery = undefined
            }
        })()
        return this.recovery
    }

    // The client's own timeout ends only the wait to send a command, so one that is sent waits here. An
    // answer that came while the event loop was held is read before an immediate runs, so it is taken.
    private run<Reply>(command: Promise<Reply>) {
        let timer: ReturnType<typeof setTimeout> | undefined = undefined
        const timeout = new Promise<never>((_, reject) => {
            const noAnswer = new Error(`Redis gave no answer within ${SHARED_CACHE_REDIS_TIMEOUT_MS} ms`)
            timer = setTimeout(() => setImmediate(() => reject(noAnswer)), SHARED_CACHE_REDIS_TIMEOUT_MS)
        })
        return Promise.race([command, timeout]).finally(() => clearTimeout(timer))
    }

    private async send(script: Script, keys: string[], args: (string | Buffer)[]) {
        try {
            return await this.client.evalSha(script.sha, { keys, arguments: args })
        } catch (error) {
            if (!(error instanceof ErrorReply) || !error.message.startsWith('NOSCRIPT')) throw error
            return await this.client.eval(script.lua, { keys, arguments: args })
        }
    }
}

function scriptOf(lua: string): Script {
    return { lua, sha: createHash('sha1').update(lua).digest('hex') }
}

function hashOf(key: string) {
    return createHash('sha256').update(key).digest('base64url')
}

function envValue(name: string): string | undefined {
    const value = process.env[name]
    if (!value || value === UNSET_PLACEHOLDER) return undefined
    return value
}
