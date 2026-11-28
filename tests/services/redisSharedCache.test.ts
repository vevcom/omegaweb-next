import { prisma } from '@/prisma-pn-client-instance'
import { RedisSharedCache, redisUrl, SHARED_CACHE_REDIS_TIMEOUT_MS } from '@/services/redisSharedCache'
import { SharedAnswer } from '@/services/sharedCache'
import logger from '@/lib/logger'
import { afterEach, describe, expect, jest, test } from '@jest/globals'
import { createClient } from '@redis/client'
import { randomUUID } from 'crypto'
import { createServer, connect } from 'net'
import { types } from 'util'
import type { Socket } from 'net'

const quotesTable = new Set(['OmegaQuote'])
const caches: RedisSharedCache[] = []
const url = redisUrl
const describeWithRedis = url ? describe : describe.skip

afterEach(() => {
    caches.splice(0).forEach(cache => cache.stop())
    jest.restoreAllMocks()
})

describeWithRedis('two processes with one cache in Redis', () => {
    test('give an answer read in one in the other', async () => {
        const [first, second] = await processes()
        const quotes = read(() => prisma.omegaQuote.count())

        await quotes.from(first)
        await quotes.from(second)

        expect(quotes.runs).toHaveBeenCalledTimes(1)
    })

    test('give no answer of a table in one once a write to it is told in the other, and still those of others', async () => {
        const [first, second] = await processes()
        const quotes = read(() => prisma.omegaQuote.count())
        const licenses = read(() => prisma.license.count())

        await quotes.from(first)
        await licenses.from(first)
        await second.tablesWritten(quotesTable)
        await quotes.from(first)
        await licenses.from(first)

        expect(quotes.runs).toHaveBeenCalledTimes(2)
        expect(licenses.runs).toHaveBeenCalledTimes(1)
    })

    test('keep no usable answer of a read in one when a write in the other was told while it ran', async () => {
        const [first, second] = await processes()
        const reading = gate()
        const waiting = gate()
        const slow = read(async () => {
            const count = await prisma.omegaQuote.count()
            waiting.open()
            await reading.opened
            return count
        })

        const underWay = slow.from(first)
        await waiting.opened
        await second.tablesWritten(quotesTable)
        reading.open()
        await underWay
        await slow.from(second)

        expect(slow.runs).toHaveBeenCalledTimes(2)
    })

    test('give no answer read by a process of another build', async () => {
        if (!url) throw new Error('REDIS_URL is not set')
        const namespace = randomUUID()
        const builds = ['a build', 'the next build'].map(build => new RedisSharedCache(url, build, namespace))
        caches.push(...builds)
        await Promise.all(builds.map(cache => cache.whenReady()))
        const quotes = read(() => prisma.omegaQuote.count())

        await quotes.from(builds[0])
        await quotes.from(builds[1])

        expect(quotes.runs).toHaveBeenCalledTimes(2)
    })

    test('keep nothing of a process with no version, as the worker, and still be told of its writes', async () => {
        if (!url) throw new Error('REDIS_URL is not set')
        const namespace = randomUUID()
        const [app] = await processes(url, namespace)
        const worker = new RedisSharedCache(url, null, namespace)
        caches.push(worker)
        await worker.whenReady()
        const quotes = read(() => prisma.omegaQuote.count())

        await quotes.from(worker)
        await quotes.from(worker)
        await quotes.from(app)
        await worker.tablesWritten(quotesTable)
        await quotes.from(app)

        expect(quotes.runs).toHaveBeenCalledTimes(4)
    })

    test('give a date back as a date', async () => {
        const [first, second] = await processes()
        const dated = read(async () => ({ count: await prisma.omegaQuote.count(), at: new Date(0) }))

        await dated.from(first)
        const given = await dated.from(second)

        expect(dated.runs).toHaveBeenCalledTimes(1)
        expect(types.isDate(given.at)).toBe(true)
    })

    test('give no answer kept before a write one of them made while it could not reach Redis', async () => {
        const proxy = await proxyToRedis()
        const [first, second] = await processes(proxy.url)
        const quotes = read(() => prisma.omegaQuote.count())
        const licenses = read(() => prisma.license.count())

        await quotes.from(second)
        proxy.cut()
        await first.tablesWritten(quotesTable)
        proxy.mend()
        // Back once an answer it reads is kept, and given to it again.
        await until(async () => {
            const runs = licenses.runs.mock.calls.length
            await licenses.from(first)
            await licenses.from(first)
            return licenses.runs.mock.calls.length === runs + 1
        })
        await quotes.from(second)

        expect(quotes.runs).toHaveBeenCalledTimes(2)
        proxy.close()
    })

    test('wait no longer than the time limit for a Redis that answers nothing, and give no answer kept before', async () => {
        const proxy = await proxyToRedis()
        const [first, second] = await processes(proxy.url)
        const quotes = read(() => prisma.omegaQuote.count())
        const licenses = read(() => prisma.license.count())

        await quotes.from(second)
        proxy.stall()
        const startedAt = Date.now()
        await first.tablesWritten(quotesTable)
        await licenses.from(first)
        await licenses.from(first)
        const waited = Date.now() - startedAt
        expect(licenses.runs).toHaveBeenCalledTimes(2)

        proxy.unstall()
        await until(async () => {
            const runs = licenses.runs.mock.calls.length
            await licenses.from(first)
            await licenses.from(first)
            return licenses.runs.mock.calls.length === runs + 1
        })
        await quotes.from(second)

        expect(waited).toBeLessThan(SHARED_CACHE_REDIS_TIMEOUT_MS + 200)
        expect(quotes.runs).toHaveBeenCalledTimes(2)
        proxy.close()
    })

    test('leave the answers of the other usable when an ask of one timed out', async () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
        const proxy = await proxyToRedis()
        const [first, second] = await processes(proxy.url)
        const quotes = read(() => prisma.omegaQuote.count())
        const licenses = read(() => prisma.license.count())

        await quotes.from(second)
        proxy.stall()
        await licenses.from(first)
        proxy.unstall()
        await until(async () => {
            const runs = licenses.runs.mock.calls.length
            await licenses.from(first)
            await licenses.from(first)
            return licenses.runs.mock.calls.length === runs + 1
        })
        await quotes.from(second)

        expect(warn).toHaveBeenCalledTimes(1)
        expect(quotes.runs).toHaveBeenCalledTimes(1)
        proxy.close()
    })

    test('take an answer that came while the event loop was held longer than the time limit', async () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
        const [first] = await processes()
        const licenses = read(() => prisma.license.count())

        const asking = licenses.from(first)
        await new Promise(resolve => setImmediate(resolve))
        const heldUntil = Date.now() + SHARED_CACHE_REDIS_TIMEOUT_MS + 50
        while (Date.now() < heldUntil) { /* a render that holds the event loop */ }
        await asking
        await licenses.from(first)

        expect(warn).not.toHaveBeenCalled()
        expect(licenses.runs).toHaveBeenCalledTimes(1)
    })

    test('give no answer kept before a write Redis refused to count', async () => {
        jest.spyOn(logger, 'warn').mockImplementation(() => logger)
        const namespace = randomUUID()
        const [first, second] = await processes(url, namespace)
        const quotes = read(() => prisma.omegaQuote.count())
        const licenses = read(() => prisma.license.count())
        const writes = `{${namespace}}:writes`

        await quotes.from(second)
        await byHand(async client => {
            const counts = await client.hGetAll(writes)
            await client.del(writes)
            await client.set(writes, 'what a tell cannot count on')
            await first.tablesWritten(quotesTable)
            await client.del(writes)
            await client.hSet(writes, counts)
        })
        await until(async () => {
            const runs = licenses.runs.mock.calls.length
            await licenses.from(first)
            await licenses.from(first)
            return licenses.runs.mock.calls.length === runs + 1
        })
        await quotes.from(second)

        expect(quotes.runs).toHaveBeenCalledTimes(2)
    })

    test('give no answer kept before Redis lost its count of writes, once a write is told', async () => {
        const namespace = randomUUID()
        const [first, second] = await processes(url, namespace)
        const quotes = read(() => prisma.omegaQuote.count())

        await quotes.from(first)
        await byHand(client => client.del(`{${namespace}}:writes`))
        await second.tablesWritten(quotesTable)
        await quotes.from(first)

        expect(quotes.runs).toHaveBeenCalledTimes(2)
    })

    test('read again, and keep anew, an answer whose bytes do not deserialize', async () => {
        const namespace = randomUUID()
        const [first] = await processes(url, namespace)
        const quotes = read(() => prisma.omegaQuote.count())

        const answer = await quotes.from(first)
        await byHand(async client => {
            const [key] = await client.keys(`{${namespace}}:answer:*`)
            await client.hSet(key, 'answer', Buffer.from([0xff, 0x0f, 0x99, 0x01]))
        })
        const given = [await quotes.from(first), await quotes.from(first)]

        expect(given).toEqual([answer, answer])
        expect(quotes.runs).toHaveBeenCalledTimes(2)
    })
})

describe('a cache in Redis that cannot be reached', () => {
    test('reads every time, is told of a write without waiting, and logs it once', async () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
        const away = new RedisSharedCache('redis://localhost:1', 'test', randomUUID())
        caches.push(away)
        const quotes = read(() => prisma.omegaQuote.count())

        await quotes.from(away)
        const startedAt = Date.now()
        await away.tablesWritten(quotesTable)
        const waited = Date.now() - startedAt
        await quotes.from(away)
        await until(() => Promise.resolve(warn.mock.calls.length > 0))

        expect(quotes.runs).toHaveBeenCalledTimes(2)
        expect(waited).toBeLessThan(SHARED_CACHE_REDIS_TIMEOUT_MS)
        expect(warn).toHaveBeenCalledTimes(1)
    })
})

/** Two processes of one build that share one cache, ready to be asked. */
async function processes(through = url, namespace = randomUUID()) {
    if (!through || !url) throw new Error('REDIS_URL is not set')
    const both = [new RedisSharedCache(through, 'test', namespace), new RedisSharedCache(url, 'test', namespace)]
    caches.push(...both)
    await Promise.all(both.map(cache => cache.whenReady()))
    return both
}

/** A shared read, asked of a cache directly as `serviceOperation.ts` asks it. */
function read<Answer>(answer: () => Promise<Answer>) {
    const runs = jest.fn()
    const name = `redisSharedCache.test.${randomUUID()}`
    return {
        from: async (cache: RedisSharedCache) => (await cache.remember(name, '{}', async () => {
            runs()
            return SharedAnswer.of(await answer())
        })).given(),
        runs,
    }
}

/** Does to Redis what no cache does, as someone at a `redis-cli` would. */
async function byHand<Result>(action: (client: ReturnType<typeof clientByHand>) => Promise<Result>) {
    const client = clientByHand()
    await client.connect()
    try {
        return await action(client)
    } finally {
        client.destroy()
    }
}

function clientByHand() {
    return createClient({ url })
}

/**
 * Passes what is sent on to Redis and back, until it is cut, and again once it is mended. Stalled, it
 * holds Redis's answers back until it is unstalled, as a Redis that is slow or paused.
 */
async function proxyToRedis() {
    const target = new URL(url ?? '')
    const sockets = new Set<Socket>()
    let isCut = false
    let isStalled = false
    const held: Buffer[] = []
    let answer = () => {}
    const server = createServer(socket => {
        if (isCut) {
            socket.destroy()
            return
        }
        const upstream = connect(Number(target.port), target.hostname)
        socket.pipe(upstream)
        upstream.on('data', (data: Buffer) => {
            if (isStalled) held.push(data)
            else socket.write(data)
        })
        answer = () => held.splice(0).forEach(data => socket.write(data))
        const close = () => {
            socket.destroy()
            upstream.destroy()
        }
        socket.on('close', close).on('error', close)
        upstream.on('close', close).on('error', close)
        sockets.add(socket).add(upstream)
    })
    await new Promise<void>(resolve => server.listen(0, 'localhost', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('The proxy has no port')
    return {
        url: `redis://localhost:${address.port}`,
        cut: () => {
            isCut = true
            sockets.forEach(socket => socket.destroy())
        },
        mend: () => {
            isCut = false
        },
        stall: () => {
            isStalled = true
        },
        unstall: () => {
            isStalled = false
            answer()
        },
        close: () => server.close(),
    }
}

async function until(isDone: () => Promise<boolean>) {
    for (let tries = 0; tries < 50; tries++) {
        if (await isDone()) return
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    throw new Error('Never done')
}

function gate() {
    let open = () => {}
    const opened = new Promise<void>(resolve => {
        open = resolve
    })
    return { opened, open: () => open() }
}
