import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { careersFrontpageOperations } from '@/services/careers/frontpage/operations'
import { MapServiceCache, NoServiceCache, serviceCacheKey } from '@/services/serviceCache'
import { defineOperation, defineSubOperation, isPrismaClient } from '@/services/serviceOperation'
import { userOperations } from '@/services/users/operations'
import { userPrivateSelection } from '@/services/users/constants'
import logger from '@/lib/logger'
import { testSession } from 'tests/utils'
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { z } from 'zod'
import type { KeysOfUnion } from '@/lib/keysOfUnion'
import type { ServiceCache } from '@/services/serviceCache'
import type { UserFiltered } from '@/services/users/types'

const authorizerRuns = jest.fn()
const runs = jest.fn()

const thingParams = z.object({ id: z.number(), filter: z.object({ tag: z.string(), limit: z.number() }).optional() })

/** A read only a holder of USERS_USE may make, which says who it was made for. */
const readThing = defineOperation({
    paramsSchema: thingParams,
    remember: true,
    authorizer: () => {
        authorizerRuns()
        return Require.permission('USERS_USE')
    },
    operation: ({ params, session, bypassAuth }) => {
        runs()
        return { id: params.id, readFor: session.user?.username ?? session.apiKeyId ?? null, bypassAuth }
    },
})

const readThingFresh = defineOperation({
    paramsSchema: thingParams,
    authorizer: () => Require.permission('USERS_USE'),
    operation: ({ params }) => {
        runs()
        return { id: params.id }
    },
})

const readThingTwice = defineOperation({
    authorizer: () => Require.nothing(),
    operation: async () => [await readThing({ params: { id: 1 } }), await readThing({ params: { id: 1 } })],
})

const reader = Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [] })
const visitor = Session.fromJsObject({ user: null, permissions: [], memberships: [] })
const unauthenticated = { errorCode: 'UNAUTHENTICATED' }

let anne: UserFiltered
let berit: UserFiltered

beforeAll(async () => {
    [anne, berit] = await Promise.all(['cache-anne', 'cache-berit'].map(username => prisma.user.create({
        data: {
            username,
            email: `${username}@omega.ntnu.no`,
            bioParagraph: { create: {} },
            ledgerAccount: { create: { type: 'USER' } },
        },
        select: userPrivateSelection,
    })))
})

afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { in: ['cache-anne', 'cache-berit'] } } })
})

beforeEach(() => {
    authorizerRuns.mockClear()
    runs.mockClear()
})

describe('a remembered operation', () => {
    test('runs once for calls that are equal by value, and again for other params', async () => {
        const cache = new MapServiceCache()

        const first = await readThing({ params: { id: 1, filter: { tag: 'a', limit: 5 } }, session: reader, cache })
        const second = await readThing({ params: { filter: { limit: 5, tag: 'a' }, id: 1 }, session: reader, cache })
        expect(runs).toHaveBeenCalledTimes(1)
        expect(authorizerRuns).toHaveBeenCalledTimes(1)
        expect(second).toBe(first)

        await readThing({ params: { id: 1, filter: { tag: 'b', limit: 5 } }, session: reader, cache })
        await readThing({ params: { id: 1 }, session: reader, cache })
        await readThing({ params: { id: 2 }, session: reader, cache })
        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('is never given the answer of another operation', async () => {
        const readOtherThing = defineOperation({
            paramsSchema: thingParams,
            remember: true,
            authorizer: () => Require.nothing(),
            operation: () => 'another thing',
        })
        const cache = new MapServiceCache()

        const thing = await readThing({ params: { id: 1 }, session: reader, cache })
        const otherThing = await readOtherThing({ params: { id: 1 }, session: reader, cache })

        expect(thing).toMatchObject({ id: 1 })
        expect(otherThing).toBe('another thing')
    })

    test('runs once for calls made at the same time', async () => {
        const cache = new MapServiceCache()

        await Promise.all([1, 2, 3].map(() => readThing({ params: { id: 1 }, session: reader, cache })))

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('runs every time when the context is handed no cache', async () => {
        await readThing({ params: { id: 1 }, session: reader })
        await readThing({ params: { id: 1 }, session: reader })
        expect(runs).toHaveBeenCalledTimes(2)

        await readThingTwice({ session: reader })
        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('a refusal is remembered and thrown again', async () => {
        const cache = new MapServiceCache()

        await expect(readThing({ params: { id: 1 }, session: visitor, cache })).rejects.toMatchObject(unauthenticated)
        await expect(readThing({ params: { id: 1 }, session: visitor, cache })).rejects.toMatchObject(unauthenticated)

        expect(authorizerRuns).toHaveBeenCalledTimes(1)
        expect(runs).not.toHaveBeenCalled()
    })

    test('a call that bypasses auth is not given a refusal, nor a call that does not what one that did read', async () => {
        const refusedFirst = new MapServiceCache()
        await expect(readThing({ params: { id: 1 }, session: visitor, cache: refusedFirst })).rejects.toThrow()
        await expect(readThing({ params: { id: 1 }, session: visitor, cache: refusedFirst, bypassAuth: true }))
            .resolves.toMatchObject({ id: 1, bypassAuth: true })

        const bypassedFirst = new MapServiceCache()
        await readThing({ params: { id: 1 }, session: visitor, cache: bypassedFirst, bypassAuth: true })
        await expect(readThing({ params: { id: 1 }, session: visitor, cache: bypassedFirst }))
            .rejects.toMatchObject(unauthenticated)
    })

    test('params that cannot be compared by value are read every time, and the operation warns of it once', async () => {
        const readByTags = defineOperation({
            paramsSchema: z.object({ id: z.number(), tags: z.set(z.string()) }),
            remember: true,
            authorizer: () => Require.nothing(),
            operation: ({ params }) => {
                runs()
                return Array.from(params.tags)
            },
        })
        const cache = new MapServiceCache()
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)

        expect(await readByTags({ params: { id: 1, tags: new Set(['a']) }, cache })).toEqual(['a'])
        expect(await readByTags({ params: { id: 1, tags: new Set(['b']) }, cache })).toEqual(['b'])

        expect(runs).toHaveBeenCalledTimes(2)
        expect(warn.mock.calls).toEqual([[expect.any(String), { params: ['tags'], implementationParams: [] }]])
        warn.mockRestore()
    })
})

describe('an operation that is not remembered', () => {
    test('runs every time, also in a context with a cache', async () => {
        const cache = new MapServiceCache()

        await readThingFresh({ params: { id: 1 }, session: reader, cache })
        await readThingFresh({ params: { id: 1 }, session: reader, cache })

        expect(runs).toHaveBeenCalledTimes(2)
    })
})

describe('an answer and the session it was read for', () => {
    const readerOf = (user: UserFiltered) => testSession({ user, permissions: ['USERS_USE'] })

    test('a session that is equal by value is given the answer', async () => {
        const cache = new MapServiceCache()

        await readThing({ params: { id: 1 }, session: readerOf(anne), cache })
        await readThing({ params: { id: 1 }, session: readerOf({ ...anne }), cache })

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('another user is never given it', async () => {
        const cache = new MapServiceCache()

        const forAnne = await readThing({ params: { id: 1 }, session: readerOf(anne), cache })
        const forBerit = await readThing({ params: { id: 1 }, session: readerOf(berit), cache })

        expect(forAnne.readFor).toBe('cache-anne')
        expect(forBerit.readFor).toBe('cache-berit')
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('the same user with other permissions is never given it, and is refused', async () => {
        const cache = new MapServiceCache()

        await readThing({ params: { id: 1 }, session: readerOf(anne), cache })

        await expect(readThing({ params: { id: 1 }, session: testSession({ user: anne, permissions: [] }), cache }))
            .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        expect(authorizerRuns).toHaveBeenCalledTimes(2)
    })

    test('a session that differs in any other field is never given it', async () => {
        const cache = new MapServiceCache()
        const membership = { groupId: 1, order: 1, admin: false, active: true, title: 'Medlem', userId: anne.id }
        const sessions = [
            reader,
            Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [], apiKeyId: 7 }),
            testSession({ permissions: ['USERS_USE'], memberships: [membership] }),
            Session.fromJsObject({
                user: null,
                companyUser: {
                    id: 1,
                    email: 'a@b.no',
                    firstname: 'A',
                    lastname: 'B',
                    company: { id: 1, name: 'C' },
                    admin: false,
                },
                permissions: ['USERS_USE'],
                memberships: [],
            }),
        ]

        for (const session of sessions) await readThing({ params: { id: 1 }, session, cache })

        expect(runs).toHaveBeenCalledTimes(sessions.length)
    })
})

describe('what a context hands a remembered call', () => {
    const readSecret = defineOperation({
        remember: true,
        authorizer: () => Require.permission('USERS_ADMIN'),
        operation: () => 'secret',
    })
    const readSecretInside = defineOperation({
        authorizer: () => Require.nothing(),
        operation: () => readSecret({}),
    })
    const admin = Session.fromJsObject({ user: null, permissions: ['USERS_ADMIN'], memberships: [] })

    test('its session is in the key, so a visitor is refused what an admin\'s context read', async () => {
        const cache = new MapServiceCache()

        await expect(readSecretInside({ session: admin, cache })).resolves.toBe('secret')
        await expect(readSecretInside({ session: visitor, cache })).rejects.toMatchObject(unauthenticated)
    })

    test('its bypassAuth is in the key, so a visitor is refused what trusted code read for them', async () => {
        const cache = new MapServiceCache()

        await expect(readSecretInside({ session: visitor, bypassAuth: true, cache })).resolves.toBe('secret')
        await expect(readSecret({ session: visitor, cache })).rejects.toMatchObject(unauthenticated)
    })
})

describe('the cache of a context', () => {
    test('is shared by the contexts opened inside it', async () => {
        const readThingThroughOthers = defineOperation({
            authorizer: () => Require.nothing(),
            operation: async () => [await readThingTwice({}), await readThing({ params: { id: 1 } })],
        })

        await readThingThroughOthers({ session: reader, cache: new MapServiceCache() })

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('is not asked inside a transaction, whether the cache was handed in or inherited', async () => {
        const cache = new MapServiceCache()
        const readThingInTransaction = defineOperation({
            authorizer: () => Require.nothing(),
            operation: async ({ prisma: client }) => {
                await readThing({ params: { id: 1 } })
                await client.$transaction(async tx => {
                    await readThing({ params: { id: 1 }, prisma: tx })
                    await readThing({ params: { id: 1 }, prisma: tx })
                })
                await readThing({ params: { id: 1 } })
            },
        })

        await prisma.$transaction(async tx => {
            await readThing({ params: { id: 1 }, session: reader, prisma: tx, cache })
            await readThing({ params: { id: 1 }, session: reader, prisma: tx, cache })
        })
        expect(runs).toHaveBeenCalledTimes(2)

        // Once outside the transaction and remembered there, and twice inside it.
        await readThingInTransaction({ session: reader, cache })
        expect(runs).toHaveBeenCalledTimes(5)
    })

    test('is replaced by a call that sets its own, for that call and what it calls', async () => {
        const readThingAroundACacheOfItsOwn = defineOperation({
            authorizer: () => Require.nothing(),
            operation: async () => {
                await readThing({ params: { id: 1 } })
                await readThingTwice({ cache: new MapServiceCache() })
                await readThing({ params: { id: 1 } })
            },
        })

        await readThingAroundACacheOfItsOwn({ session: reader, cache: new MapServiceCache() })

        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('is refused when it answers with what the operation never read', async () => {
        const answersForAnother: ServiceCache = { remember: () => Promise.resolve({ id: 1, readFor: 'cache-berit' }) }

        await expect(readThing({ params: { id: 1 }, session: reader, cache: answersForAnother }))
            .rejects.toMatchObject({ errorCode: 'SERVER ERROR' })
        expect(runs).not.toHaveBeenCalled()
    })

    test('is left alone by a call that sets NoServiceCache, which reads fresh', async () => {
        const cache = new MapServiceCache()

        await readThing({ params: { id: 1 }, session: reader, cache })
        await readThing({ params: { id: 1 }, session: reader, cache: new NoServiceCache() })
        expect(runs).toHaveBeenCalledTimes(2)

        await readThing({ params: { id: 1 }, session: reader, cache })
        expect(runs).toHaveBeenCalledTimes(2)
    })
})

describe('a sub-operation', () => {
    const ownershipChecks = jest.fn()
    const readPart = defineSubOperation({
        paramsSchema: () => z.object({ id: z.number() }),
        operation: () => ({ params }) => {
            runs()
            return params.id
        },
    })
    const implementation = {
        implementationParamsSchema: z.object({ ownerId: z.number() }),
        authorizer: () => Require.nothing(),
        ownershipCheck: () => {
            ownershipChecks()
            return true
        },
    }
    const remembered = readPart.implement({ ...implementation, remember: true })
    const fresh = readPart.implement(implementation)

    beforeEach(() => {
        ownershipChecks.mockClear()
    })

    test('is remembered by the implementation that says so, with its ownership check, and by no other', async () => {
        const cache = new MapServiceCache()

        await remembered({ params: { id: 1 }, implementationParams: { ownerId: 1 }, cache })
        await remembered({ params: { id: 1 }, implementationParams: { ownerId: 1 }, cache })
        expect(runs).toHaveBeenCalledTimes(1)
        expect(ownershipChecks).toHaveBeenCalledTimes(1)

        await fresh({ params: { id: 1 }, implementationParams: { ownerId: 1 }, cache })
        await fresh({ params: { id: 1 }, implementationParams: { ownerId: 1 }, cache })
        expect(runs).toHaveBeenCalledTimes(3)
    })

    test('is read again for other implementation params', async () => {
        const cache = new MapServiceCache()

        await remembered({ params: { id: 1 }, implementationParams: { ownerId: 1 }, cache })
        await remembered({ params: { id: 1 }, implementationParams: { ownerId: 2 }, cache })

        expect(runs).toHaveBeenCalledTimes(2)
    })
})

describe('a sub-operation that says it is remembered where it is defined', () => {
    const readPart = defineSubOperation({
        paramsSchema: () => z.object({ id: z.number() }),
        remember: true,
        operation: (fields: { times: number } | undefined) => ({ params, prisma: client }) => {
            runs()
            return { answer: params.id * (fields?.times ?? 1), inTransaction: !isPrismaClient(client) }
        },
    })
    const implementation = { authorizer: () => Require.nothing(), ownershipCheck: () => true }
    const once = { operationImplementationFields: undefined, params: { id: 1 } }

    test('is remembered by its internal calls, which share their answers with no implementation', async () => {
        const cache = new MapServiceCache()

        expect(await readPart.internalCall({ ...once, cache })).toBe(await readPart.internalCall({ ...once, cache }))
        expect(runs).toHaveBeenCalledTimes(1)

        await readPart.internalCall({ ...once, params: { id: 2 }, cache })
        const implemented = readPart.implement({ ...implementation, operationImplementationFields: undefined })
        await implemented({ params: { id: 1 }, cache })
        expect(runs).toHaveBeenCalledTimes(3)
    })

    test('is read every time by an internal call with no cache, and by one handed a transaction', async () => {
        await readPart.internalCall(once)
        await readPart.internalCall(once)
        expect(runs).toHaveBeenCalledTimes(2)

        const cache = new MapServiceCache()
        await readPart.internalCall({ ...once, cache })
        await prisma.$transaction(async tx => {
            expect(await readPart.internalCall({ ...once, cache, prisma: tx })).toMatchObject({ inTransaction: true })
        })
        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('internal calls implemented with other fields do not share an answer', async () => {
        const cache = new MapServiceCache()
        const twice = { ...once, operationImplementationFields: { times: 2 }, cache }

        expect(await readPart.internalCall(twice)).toMatchObject({ answer: 2 })
        expect(await readPart.internalCall({ ...once, cache })).toMatchObject({ answer: 1 })
        expect(await readPart.internalCall(twice)).toMatchObject({ answer: 2 })
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('the implementation decides: one that says no reads every time, one that says nothing is remembered', async () => {
        const cache = new MapServiceCache()
        const fresh = readPart.implement({ ...implementation, operationImplementationFields: undefined, remember: false })
        const asDefined = readPart.implement({ ...implementation, operationImplementationFields: undefined })

        await fresh({ params: { id: 1 }, cache })
        await fresh({ params: { id: 1 }, cache })
        expect(runs).toHaveBeenCalledTimes(2)

        await asDefined({ params: { id: 1 }, cache })
        await asDefined({ params: { id: 1 }, cache })
        expect(runs).toHaveBeenCalledTimes(3)
    })
})

describe('the key of a call', () => {
    test('is the same for values that are equal, whatever order their fields were written in', () => {
        const key = serviceCacheKey({ id: 1, filter: { tag: 'a', from: new Date(5) }, ids: [1, 2] })

        expect(serviceCacheKey({ ids: [1, 2], filter: { from: new Date(5), tag: 'a' }, id: 1 })).toBe(key)
        expect(key).toBeDefined()
    })

    test('differs for values that differ, also those JSON writes alike', () => {
        const different = [
            null, undefined, 'null', 'undefined', 0, '0', BigInt(0), false, 'false', NaN, [], {}, [null], [undefined], [[]],
            { id: null }, { id: undefined }, { id: 1 }, { id: '1' }, { id: [1] }, { di: 1 },
            new Date(0), '1970-01-01T00:00:00.000Z', 'Date(0)',
            [1, [2]], [[1], 2], [1, 2], ['1,2'], ['1', '2'], { id: { tag: 1 } }, { 'id.tag': 1 }, { id: 1, tag: 1 },
        ]

        const keys = different.map(serviceCacheKey)

        expect(keys).not.toContain(undefined)
        expect(new Set(keys).size).toBe(different.length)
    })

    test('is missing for a value that cannot be compared by value, wherever it sits', () => {
        class Thing {
            public id = 1
        }

        const incomparable = [
            new Map(), new Set([1]), new Thing(), () => 1, Symbol('id'), [new Thing()], { id: { thing: new Thing() } },
        ]

        expect(incomparable.map(serviceCacheKey)).toEqual(incomparable.map(() => undefined))
    })

    test('is missing for a value that holds itself or has a symbol for a field, and not for one held twice', () => {
        const holdsItself: { id: number, self?: unknown } = { id: 1 }
        holdsItself.self = [holdsItself]
        const heldTwice = { tag: 'a' }

        expect(serviceCacheKey(holdsItself)).toBeUndefined()
        expect(serviceCacheKey({ id: 1, [Symbol('hidden')]: 2 })).toBeUndefined()
        expect(serviceCacheKey({ first: heldTwice, second: heldTwice }))
            .toBe(serviceCacheKey({ first: { tag: 'a' }, second: { tag: 'a' } }))
    })
})

/**
 * `remember` is refused on what the compiler can see is no read. The `@ts-expect-error` lines are
 * the test of that: `tsc` fails on any of them that stops being an error. Each refused operation is
 * then called, since a `remember` that got past the compiler must not be honoured either.
 */
describe('the types of remember', () => {
    const data = z.object({ name: z.string() })
    const implementation = { authorizer: () => Require.nothing(), ownershipCheck: () => true }

    test('it does not compile on an operation with a data schema, and such a call is never remembered', async () => {
        const writeName = defineOperation({
            dataSchema: data,
            // @ts-expect-error - an operation that takes data is no read
            remember: true,
            authorizer: () => Require.nothing(),
            operation: ({ data: { name } }) => name,
        })
        const writeNameOfPart = defineSubOperation({
            dataSchema: () => data,
            operation: () => ({ data: { name } }) => name,
        }).implement({
            ...implementation,
            // @ts-expect-error - an operation that takes data is no read
            remember: true,
        })
        const cache = new MapServiceCache()

        for (const write of [writeName, writeNameOfPart]) {
            expect(await write({ data: { name: 'first' }, cache })).toBe('first')
            expect(await write({ data: { name: 'second' }, cache })).toBe('second')
        }
    })

    test('it does not compile on an operation that opens or runs in a transaction, which keeps it', async () => {
        const inTransaction = defineOperation({
            transaction: 'RUNS_IN',
            // @ts-expect-error - what runs in a transaction writes
            remember: true,
            authorizer: () => Require.nothing(),
            operation: ({ prisma: client }) => !isPrismaClient(client),
        })
        const inTransactionOfPart = defineSubOperation({
            transaction: 'RUNS_IN',
            operation: () => ({ prisma: client }) => !isPrismaClient(client),
        }).implement({
            ...implementation,
            // @ts-expect-error - what runs in a transaction writes
            remember: true,
        })
        const opensTransaction = defineOperation({
            transaction: 'OPENS',
            // @ts-expect-error - what opens a transaction writes
            remember: true,
            authorizer: () => Require.nothing(),
            operation: () => runs(),
        })
        const cache = new MapServiceCache()

        expect(await inTransaction({ cache })).toBe(true)
        expect(await inTransactionOfPart({ cache })).toBe(true)
        await opensTransaction({ cache })
        await opensTransaction({ cache })
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('it compiles on an operation with neither, also one that says it has no transaction', () => {
        const operations = [
            defineOperation({ remember: true, authorizer: () => Require.nothing(), operation: () => null }),
            defineOperation({
                transaction: 'NONE',
                remember: true,
                authorizer: () => Require.nothing(),
                operation: () => null,
            }),
        ]

        expect(operations).toHaveLength(2)
    })

    test('an internal call cannot be handed it, and one that is keeps its transaction', async () => {
        const write = defineSubOperation({
            transaction: 'RUNS_IN',
            dataSchema: () => data,
            operation: () => ({ prisma: client }) => !isPrismaClient(client),
        })
        // Made beforehand, since an object written in the call is refused for any field the call does not know.
        const args = { data: { name: 'first' }, remember: true }

        // @ts-expect-error - an internal call is not remembered
        const wasInTransaction = await write.internalCall(args)

        expect(wasInTransaction).toBe(true)
    })

    test('an internal call that is handed it past the compiler does not decide', async () => {
        const read = defineSubOperation({
            operation: () => () => {
                runs()
                return 1
            },
        })
        const cache = new MapServiceCache()
        const args = { cache, remember: true }

        // @ts-expect-error - an internal call is not remembered
        await read.internalCall(args)
        // @ts-expect-error - an internal call is not remembered
        await read.internalCall(args)

        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('a field only one kind of session has is among those the key must hold', () => {
        type Sessions = { permissions: string[], user: string } | { permissions: string[], apiKeyId: number }
        const every: Record<KeysOfUnion<Sessions>, true> = { permissions: true, user: true, apiKeyId: true }
        // @ts-expect-error - `apiKeyId` is a field of one of them
        const shared: Record<KeysOfUnion<Sessions>, true> = { permissions: true, user: true }

        expect(Object.keys(every)).toHaveLength(Object.keys(shared).length + 1)
    })
})

describe('the operations that are remembered', () => {
    test('a profile is read once for its user, and a user who may not read it is still refused', async () => {
        const cache = new MapServiceCache()
        const asAnne = testSession({ user: anne })

        const profile = await userOperations.readProfile({ params: { username: anne.username }, session: asAnne, cache })
        await prisma.user.update({ where: { id: anne.id }, data: { firstname: 'Anne Etterpå' } })
        const again = await userOperations.readProfile({ params: { username: anne.username }, session: asAnne, cache })
        const fresh = await userOperations.readProfile({ params: { username: anne.username }, session: asAnne })

        expect(again).toBe(profile)
        expect(fresh.user.firstname).toBe('Anne Etterpå')
        await expect(userOperations.readProfile({
            params: { username: anne.username },
            session: testSession({ user: berit }),
            cache,
        })).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
    })

    test('a special link that is missing is created once by reads made at the same time', async () => {
        await prisma.cmsLink.deleteMany({ where: { special: 'CAREER_CONTACT' } })
        const cache = new MapServiceCache()

        const links = await Promise.all([1, 2, 3].map(() => careersFrontpageOperations.cmsLinks.read({
            params: { special: 'CAREER_CONTACT' },
            session: visitor,
            cache,
        })))

        expect(new Set(links.map(link => link.id)).size).toBe(1)
        expect(await prisma.cmsLink.count({ where: { special: 'CAREER_CONTACT' } })).toBe(1)
    })
})
