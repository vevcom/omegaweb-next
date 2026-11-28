import { apiHandler } from '@/api/apiHandler'
import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { MapLocalCache } from '@/services/localCache'
import { MapSharedCache, SHARED_CACHE_SIZE, SHARED_CACHE_TIME_LIMIT_MS } from '@/services/sharedCache'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import logger from '@/lib/logger'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { z } from 'zod'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { SessionMaybeUser } from '@/auth/session/Session'
import type { Permission } from '@/prisma-generated-pn-types'

type Client = Prisma.TransactionClient

const numberParams = z.object({ position: z.number().optional() })

const quotes = sharedRead(client => client.omegaQuote.count())
const licenses = sharedRead(client => client.license.count())

const writeQuotes = (client: Client) => client.omegaQuote.updateMany({ where: { id: -1 }, data: { quote: 'none' } })
const writeIt = (transaction: 'NONE' | 'RUNS_IN') => defineOperation({
    transaction,
    read: false,
    authorizer: () => Require.nothing(),
    operation: ({ prisma: client }) => writeQuotes(client),
})
const writeQuotesOperation = writeIt('NONE')
const readElsewhere = defineOperation({
    read: true,
    authorizer: () => Require.nothing(),
    operation: () => 'read from another system',
})

/** A request with a local cache of its own, as a render and an API request have. */
const inARequest = <Result>(callback: () => Promise<Result>) => MapLocalCache.begin(callback)

beforeEach(() => {
    MapSharedCache.beginForProcess()
    quotes.runs.mockClear()
    licenses.runs.mockClear()
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('a shared read', () => {
    test('is answered from the shared cache in the next request', async () => {
        await inARequest(quotes.read)
        await inARequest(quotes.read)

        expect(quotes.runs).toHaveBeenCalledTimes(1)
    })

    const writes: [string, () => Promise<unknown>][] = [
        ['an operation in a request', () => inARequest(() => writeQuotesOperation({}))],
        ['an operation called with no local cache, as an action is', () => writeQuotesOperation({})],
        ['an API handler', () => apiHandler({
            serviceOperation: writeQuotesOperation,
            session: () => Promise.resolve(Session.empty()),
        })(new Request('https://omega.ntnu.no/api/v1/quotes', { method: 'POST' }))],
        ['an operation that runs in a transaction', () => writeIt('RUNS_IN')({})],
        ['a transaction that is rolled back', () => prisma.$transaction(async tx => {
            await writeQuotes(tx)
            throw new Error('rolled back')
        }).catch(() => null)],
        ['a write outside every operation, as a worker in the process makes', () => writeQuotes(prisma)],
    ]

    test.each(writes)('is read again in the next request after a write to its table by %s, and not others', async (
        kind, write
    ) => {
        await inARequest(async () => [await quotes.read(), await licenses.read()])
        await write()
        await inARequest(async () => [await quotes.read(), await licenses.read()])

        expect(quotes.runs).toHaveBeenCalledTimes(2)
        expect(licenses.runs).toHaveBeenCalledTimes(1)
    })

    test('is not read again before a transaction that writes its table has committed', async () => {
        await inARequest(quotes.read)
        await prisma.$transaction(async tx => {
            await writeQuotes(tx)
            await inARequest(quotes.read)
            expect(quotes.runs).toHaveBeenCalledTimes(1)
        })
        await inARequest(quotes.read)

        expect(quotes.runs).toHaveBeenCalledTimes(2)
    })

    test('is read again once its time limit has passed', async () => {
        const startedAt = Date.now()
        await inARequest(quotes.read)
        jest.spyOn(Date, 'now').mockReturnValue(startedAt + SHARED_CACHE_TIME_LIMIT_MS - 1000)
        await inARequest(quotes.read)
        expect(quotes.runs).toHaveBeenCalledTimes(1)

        jest.spyOn(Date, 'now').mockReturnValue(startedAt + SHARED_CACHE_TIME_LIMIT_MS + 1000)
        await inARequest(quotes.read)
        expect(quotes.runs).toHaveBeenCalledTimes(2)
    })

    test('runs its authorizer on every call, so who may not read is refused while others are answered', async () => {
        const adminWith = (permissions: Permission[]) => Session.fromJsObject({ user: null, permissions, memberships: [] })
        const admin = adminWith(['FRONTPAGE_ADMIN'])
        const otherAdmin = adminWith(['FRONTPAGE_ADMIN', 'USERS_USE'])
        const forAdmins = sharedRead(client => client.omegaQuote.count(), () => Require.permission('FRONTPAGE_ADMIN'))

        await inARequest(() => forAdmins.read(admin))
        await expect(inARequest(() => forAdmins.read(Session.empty()))).rejects.toThrow()
        await inARequest(() => forAdmins.read(otherAdmin))

        expect(forAdmins.runs).toHaveBeenCalledTimes(1)
        expect(forAdmins.authorizerRuns).toHaveBeenCalledTimes(3)
    })

    test('gives every caller a copy of its own, also the caller whose read it was', async () => {
        const list = sharedRead(async client => ({ quotes: await client.omegaQuote.count(), list: ['kept'] }))

        const first = await inARequest(list.read)
        first.list.push('changed by the first')
        const second = await inARequest(list.read)
        second.list.push('changed by the second')

        expect(await inARequest(list.read)).toEqual({ quotes: first.quotes, list: ['kept'] })
        expect(list.runs).toHaveBeenCalledTimes(1)
    })

    test('is filled with no answer of the request\'s local cache, which may be from before a write', async () => {
        const licenseCount = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: ({ prisma: client }) => client.license.count(),
        })
        const throughIt = sharedRead(() => licenseCount({}))
        const readByTheRequest = gate()
        const writtenByAnother = gate()

        const request = inARequest(async () => {
            await licenseCount({})
            readByTheRequest.open()
            await writtenByAnother.opened
            return await throughIt.read()
        })
        await readByTheRequest.opened
        await prisma.license.create({ data: { name: 'written by another request', link: '' } })
        writtenByAnother.open()
        await request

        expect(await inARequest(throughIt.read)).toBe(await prisma.license.count())
    })

    test('runs the afterRun of its implementation also when the shared cache answers', async () => {
        const afterRuns = jest.fn()
        const owner = subOperationOfName(jest.fn()).implement({
            operationImplementationFields: { name: 'owner' },
            authorizer: () => Require.nothing(),
            ownershipCheck: () => true,
            afterRun: () => {
                afterRuns()
            },
        })

        await inARequest(() => owner({}))
        await inARequest(() => owner({}))

        expect(afterRuns).toHaveBeenCalledTimes(2)
    })

    test('shares one run between the calls made while it runs', async () => {
        await Promise.all([inARequest(quotes.read), inARequest(quotes.read)])

        expect(quotes.runs).toHaveBeenCalledTimes(1)
    })

    test('does not share a failure, neither with a later call nor with one made while it ran', async () => {
        let failures = 0
        const failsOnce = sharedRead(async client => {
            const count = await client.omegaQuote.count()
            if (failures++ === 0) throw new Error('failed')
            return count
        })

        const [failed, madeWhileItRan] = await Promise.allSettled([inARequest(failsOnce.read), inARequest(failsOnce.read)])
        await inARequest(failsOnce.read)

        expect([failed.status, madeWhileItRan.status]).toEqual(['rejected', 'fulfilled'])
        expect(failsOnce.runs).toHaveBeenCalledTimes(2)
    })

    test('is not kept when a write to its table ended while it was read', async () => {
        const reading = gate()
        const waiting = gate()
        const slow = sharedRead(async client => {
            const count = await client.omegaQuote.count()
            waiting.open()
            await reading.opened
            return count
        })

        const underWay = inARequest(slow.read)
        await waiting.opened
        await writeQuotes(prisma)
        reading.open()
        await underWay
        await inARequest(slow.read)

        expect(slow.runs).toHaveBeenCalledTimes(2)
    })

    test('is not shared with a call made while it runs when a write to its table has ended since it began', async () => {
        const reading = gate()
        const waiting = gate()
        const slow = sharedRead(async client => {
            const count = await client.omegaQuote.count()
            waiting.open()
            await reading.opened
            return count
        })

        const underWay = inARequest(slow.read)
        await waiting.opened
        await writeQuotes(prisma)
        const askedAfterTheWrite = inARequest(slow.read)
        reading.open()
        await Promise.all([underWay, askedAfterTheWrite])

        expect(slow.runs).toHaveBeenCalledTimes(2)
    })

    test('adds its tables to the read that asked for it, also when the shared cache answered', async () => {
        const outerRuns = jest.fn()
        const readThroughIt = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: async () => {
                outerRuns()
                return await quotes.read()
            },
        })

        await inARequest(quotes.read)
        await inARequest(async () => {
            await readThroughIt({})
            await prisma.license.updateMany({ where: { id: -1 }, data: { link: 'none' } })
            await readThroughIt({})
            expect(outerRuns).toHaveBeenCalledTimes(1)

            await writeQuotes(prisma)
            await readThroughIt({})
        })

        expect(quotes.runs).toHaveBeenCalledTimes(2)
        expect(outerRuns).toHaveBeenCalledTimes(2)
    })

    test('keeps the most recently used answers, as many as the size allows', async () => {
        const numbered = sharedRead(client => client.omegaQuote.count())
        const readNumber = (position: number) => inARequest(() => numbered.read(Session.empty(), { position }))

        for (let position = 0; position < SHARED_CACHE_SIZE; position++) await readNumber(position)
        await readNumber(0)
        await readNumber(SHARED_CACHE_SIZE)
        await readNumber(0)
        expect(numbered.runs).toHaveBeenCalledTimes(SHARED_CACHE_SIZE + 1)

        await readNumber(1)
        expect(numbered.runs).toHaveBeenCalledTimes(SHARED_CACHE_SIZE + 2)
    })
})

describe('the key of a shared read', () => {
    test('holds the implementation params', async () => {
        const owner = subOperationOfName(jest.fn()).implement({
            implementationParamsSchema: z.object({ name: z.string() }),
            operationImplementationFields: ({ implementationParams }) => ({ name: implementationParams.name }),
            authorizer: () => Require.nothing(),
            ownershipCheck: () => true,
        })

        const first = await inARequest(() => owner({ implementationParams: { name: 'first' } }))
        const second = await inARequest(() => owner({ implementationParams: { name: 'second' } }))

        expect([first.name, second.name]).toEqual(['first', 'second'])
    })

    test('tells two owners apart, and an ownership check that refuses wins over a kept answer', async () => {
        const runs = jest.fn()
        const subOperation = subOperationOfName(runs)
        let owns = true
        const ownerOf = (name: string) => subOperation.implement({
            operationImplementationFields: { name },
            authorizer: () => Require.nothing(),
            ownershipCheck: () => owns,
        })
        const first = ownerOf('first')
        const second = ownerOf('second')

        const answers = [await inARequest(() => first({})), await inARequest(() => second({}))]
        owns = false
        await expect(inARequest(() => first({}))).rejects.toThrow()

        expect(answers.map(answer => answer.name)).toEqual(['first', 'second'])
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('joins the internal calls with the same params and fields, and tells other fields apart', async () => {
        const runs = jest.fn()
        const subOperation = subOperationOfName(runs)
        const internalCall = (name: string) => inARequest(() => subOperation.internalCall({
            operationImplementationFields: { name },
        }))

        const answers = [await internalCall('first'), await internalCall('first'), await internalCall('second')]

        expect(answers.map(answer => answer.name)).toEqual(['first', 'first', 'second'])
        expect(runs).toHaveBeenCalledTimes(2)
    })
})

describe('a shared read is not shared', () => {
    const callers: [string, <Result>(callback: () => Promise<Result>) => Promise<Result>][] = [
        ['in a request', inARequest],
        ['with no local cache in force, as where the session is made', callback => callback()],
    ]

    describe.each(callers)('called %s', (where, call) => {
        test.each([
            ['when it reads no table', sharedRead(() => Promise.resolve('read from another system'))],
            ['when its tables cannot be told', sharedRead(
                client => client.$queryRaw`SELECT count(*)::int FROM "OmegaQuote"`
            )],
            ['when it asks for a read of another system', sharedRead(async client => {
                await client.omegaQuote.count()
                return await readElsewhere({})
            })],
        ])('%s', async (kind, read) => {
            await call(read.read)
            await call(read.read)

            expect(read.runs).toHaveBeenCalledTimes(2)
        })
    })

    test('when its answer is not plain data, with a warning the first time', async () => {
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)
        const instance = sharedRead(async client => new Quotes(await client.omegaQuote.count()))

        await inARequest(instance.read)
        await inARequest(instance.read)

        expect(instance.runs).toHaveBeenCalledTimes(2)
        expect(warn).toHaveBeenCalledTimes(1)
    })

    test('when its authorizer hands it a filter', async () => {
        const runs = jest.fn()
        const filtered = defineOperation({
            read: true,
            shared: true,
            authorizer: () => Require.filter(() => ({ quote: { not: '' } })),
            operation: async ({ prisma: client }, filter) => {
                runs()
                return await client.omegaQuote.count({ where: filter })
            },
        })

        await inARequest(() => filtered({}))
        await inARequest(() => filtered({}))

        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('in a transaction', async () => {
        await prisma.$transaction(async tx => {
            await quotes.read(Session.empty(), undefined, tx)
            await quotes.read(Session.empty(), undefined, tx)
        })
        await inARequest(quotes.read)

        expect(quotes.runs).toHaveBeenCalledTimes(3)
    })

    test('while something that is not a read runs', async () => {
        const readsWhileItRuns = defineOperation({
            read: false,
            authorizer: () => Require.nothing(),
            operation: async () => [await quotes.read(), await quotes.read()],
        })

        await readsWhileItRuns({})
        await inARequest(quotes.read)

        expect(quotes.runs).toHaveBeenCalledTimes(3)
    })
})

class Quotes {
    public constructor(public readonly count: number) {}
}

function sharedRead<Answer>(
    read: (client: Client) => Promise<Answer>,
    authorizer: () => Authorizer = () => Require.nothing(),
) {
    const runs = jest.fn()
    const authorizerRuns = jest.fn()
    const operation = defineOperation({
        paramsSchema: numberParams,
        read: true,
        shared: true,
        authorizer: () => {
            authorizerRuns()
            return authorizer()
        },
        operation: async ({ prisma: client }) => {
            runs()
            return await read(client)
        },
    })
    return {
        read: (
            session: SessionMaybeUser = Session.empty(),
            params: z.input<typeof numberParams> = {},
            client: Client = prisma,
        ) => operation({ params, session, prisma: client }),
        runs,
        authorizerRuns,
    }
}

/** A shared sub-operation whose answer holds the name its implementation gives it. */
function subOperationOfName(runs: () => void) {
    return defineSubOperation({
        read: true,
        shared: true,
        operation: ({ name }: { name: string }) => async ({ prisma: client }) => {
            runs()
            return { name, quotes: await client.omegaQuote.count() }
        },
    })
}

function gate() {
    let open = () => {}
    const opened = new Promise<void>(resolve => {
        open = resolve
    })
    return { opened, open: () => open() }
}
