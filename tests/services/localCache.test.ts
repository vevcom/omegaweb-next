import { Require } from '@/auth/authorizer/Require'
import { Session } from '@/auth/session/Session'
import { prisma } from '@/prisma-pn-client-instance'
import { apiKeyOperations } from '@/services/apiKeys/operations'
import { careersFrontpageOperations } from '@/services/careers/frontpage/operations'
import { Smorekopp } from '@/services/error'
import { readEventAccess } from '@/services/events/access'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { eventTagOperations } from '@/services/events/tags/operations'
import { standardImageCollection } from '@/services/images/standard/standardImageCollection'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { readAliasOwnerMatrices, readMailingListOwnerMatrices } from '@/services/mail/owned'
import { LocalCache, MapLocalCache, localCacheKey } from '@/services/localCache'
import { defineOperation, defineSubOperation, isPrismaClient, withServiceContext } from '@/services/serviceOperation'
import { userOperations } from '@/services/users/operations'
import { userPrivateSelection } from '@/services/users/constants'
import logger from '@/lib/logger'
import { activeMembersOf, testSession } from 'tests/utils'
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { z } from 'zod'
import type { KeysOfUnion } from '@/lib/keysOfUnion'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { UserFiltered } from '@/services/users/types'

const authorizerRuns = jest.fn()
const runs = jest.fn()

const thingParams = z.object({ id: z.number(), filter: z.object({ tag: z.string(), limit: z.number() }).optional() })

/** A read only a holder of USERS_USE may make, which says who it was made for. */
const readThing = defineOperation({
    paramsSchema: thingParams,
    read: true,
    authorizer: () => {
        authorizerRuns()
        return Require.permission('USERS_USE')
    },
    operation: ({ params, session, bypassAuth }) => {
        runs()
        return { id: params.id, readFor: session.user?.username ?? session.apiKeyId ?? null, bypassAuth }
    },
})

const writeThing = defineOperation({
    paramsSchema: thingParams,
    read: false,
    authorizer: () => Require.permission('USERS_USE'),
    operation: ({ params }) => {
        runs()
        return { id: params.id }
    },
})

const readThingTwice = defineOperation({
    read: true,
    authorizer: () => Require.nothing(),
    operation: async () => [await readThing({ params: { id: 1 } }), await readThing({ params: { id: 1 } })],
})

const reader = Session.fromJsObject({ user: null, permissions: ['USERS_USE'], memberships: [] })
const readThingOnce = () => readThing({ params: { id: 1 }, session: reader })
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

describe('a read', () => {
    test('runs once for calls that are equal by value, and again for other params', async () => {
        await MapLocalCache.begin(async () => {
            const first = await readThing({ params: { id: 1, filter: { tag: 'a', limit: 5 } }, session: reader })
            const second = await readThing({ params: { filter: { limit: 5, tag: 'a' }, id: 1 }, session: reader })
            expect(runs).toHaveBeenCalledTimes(1)
            expect(authorizerRuns).toHaveBeenCalledTimes(1)
            expect(second).toBe(first)

            await readThing({ params: { id: 1, filter: { tag: 'b', limit: 5 } }, session: reader })
            await readThing({ params: { id: 1 }, session: reader })
            await readThing({ params: { id: 2 }, session: reader })
            expect(runs).toHaveBeenCalledTimes(4)
        })
    })

    test('is never given the answer of another operation', async () => {
        const readOtherThing = defineOperation({
            paramsSchema: thingParams,
            read: true,
            authorizer: () => Require.nothing(),
            operation: () => 'another thing',
        })

        await MapLocalCache.begin(async () => {
            const thing = await readThing({ params: { id: 1 }, session: reader })
            const otherThing = await readOtherThing({ params: { id: 1 }, session: reader })

            expect(thing).toMatchObject({ id: 1 })
            expect(otherThing).toBe('another thing')
        })
    })

    test('runs once for calls made at the same time', async () => {
        await MapLocalCache.begin(() => Promise.all([1, 2, 3].map(() => readThingOnce())))

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('runs every time when no local cache is in force', async () => {
        await readThingOnce()
        await readThingOnce()
        expect(runs).toHaveBeenCalledTimes(2)

        await readThingTwice({ session: reader })
        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('a refusal is remembered and thrown again', async () => {
        await MapLocalCache.begin(async () => {
            await expect(readThing({ params: { id: 1 }, session: visitor })).rejects.toMatchObject(unauthenticated)
            await expect(readThing({ params: { id: 1 }, session: visitor })).rejects.toMatchObject(unauthenticated)
        })

        expect(authorizerRuns).toHaveBeenCalledTimes(1)
        expect(runs).not.toHaveBeenCalled()
    })

    test('a call that bypasses auth is not given a refusal, nor a call that does not what one that did read', async () => {
        await MapLocalCache.begin(async () => {
            await expect(readThing({ params: { id: 1 }, session: visitor })).rejects.toThrow()
            await expect(readThing({ params: { id: 1 }, session: visitor, bypassAuth: true }))
                .resolves.toMatchObject({ id: 1, bypassAuth: true })
        })

        await MapLocalCache.begin(async () => {
            await readThing({ params: { id: 1 }, session: visitor, bypassAuth: true })
            await expect(readThing({ params: { id: 1 }, session: visitor })).rejects.toMatchObject(unauthenticated)
        })
    })

    test('params that cannot be compared by value are read every time, and the operation warns of it once', async () => {
        const readByTags = defineOperation({
            paramsSchema: z.object({ id: z.number(), tags: z.set(z.string()) }),
            read: true,
            authorizer: () => Require.nothing(),
            operation: ({ params }) => {
                runs()
                return Array.from(params.tags)
            },
        })
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)

        await MapLocalCache.begin(async () => {
            expect(await readByTags({ params: { id: 1, tags: new Set(['a']) } })).toEqual(['a'])
            expect(await readByTags({ params: { id: 1, tags: new Set(['b']) } })).toEqual(['b'])
        })

        expect(runs).toHaveBeenCalledTimes(2)
        expect(warn.mock.calls).toEqual([[expect.any(String), { params: ['tags'], implementationParams: [] }]])
        warn.mockRestore()
    })
})

describe('an operation that is not a read', () => {
    test('runs every time, also with a local cache in force', async () => {
        await MapLocalCache.begin(async () => {
            await writeThing({ params: { id: 1 }, session: reader })
            await writeThing({ params: { id: 1 }, session: reader })
        })

        expect(runs).toHaveBeenCalledTimes(2)
    })
})

describe('an answer and the session it was read for', () => {
    const readerOf = (user: UserFiltered) => testSession({ user, permissions: ['USERS_USE'] })

    test('a session that is equal by value is given the answer', async () => {
        await MapLocalCache.begin(async () => {
            await readThing({ params: { id: 1 }, session: readerOf(anne) })
            await readThing({ params: { id: 1 }, session: readerOf({ ...anne }) })
        })

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('another user is never given it', async () => {
        await MapLocalCache.begin(async () => {
            const forAnne = await readThing({ params: { id: 1 }, session: readerOf(anne) })
            const forBerit = await readThing({ params: { id: 1 }, session: readerOf(berit) })

            expect(forAnne.readFor).toBe('cache-anne')
            expect(forBerit.readFor).toBe('cache-berit')
        })
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('the same user with other permissions is never given it, and is refused', async () => {
        await MapLocalCache.begin(async () => {
            await readThing({ params: { id: 1 }, session: readerOf(anne) })

            await expect(readThing({ params: { id: 1 }, session: testSession({ user: anne, permissions: [] }) }))
                .rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        })
        expect(authorizerRuns).toHaveBeenCalledTimes(2)
    })

    test('a session that differs in any other field is never given it', async () => {
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

        await MapLocalCache.begin(async () => {
            for (const session of sessions) await readThing({ params: { id: 1 }, session })
        })

        expect(runs).toHaveBeenCalledTimes(sessions.length)
    })
})

describe('what a context hands the call of a read', () => {
    const readSecret = defineOperation({
        read: true,
        authorizer: () => Require.permission('USERS_ADMIN'),
        operation: () => 'secret',
    })
    const readSecretInside = defineOperation({
        read: true,
        authorizer: () => Require.nothing(),
        operation: () => readSecret({}),
    })
    const admin = Session.fromJsObject({ user: null, permissions: ['USERS_ADMIN'], memberships: [] })

    test('its session is in the key, so a visitor is refused what an admin\'s context read', async () => {
        await MapLocalCache.begin(async () => {
            await expect(readSecretInside({ session: admin })).resolves.toBe('secret')
            await expect(readSecretInside({ session: visitor })).rejects.toMatchObject(unauthenticated)
        })
    })

    test('its bypassAuth is in the key, so a visitor is refused what trusted code read for them', async () => {
        await MapLocalCache.begin(async () => {
            await expect(readSecretInside({ session: visitor, bypassAuth: true })).resolves.toBe('secret')
            await expect(readSecret({ session: visitor })).rejects.toMatchObject(unauthenticated)
        })
    })
})

describe('the local cache in force', () => {
    test('is in force for everything called inside what began it', async () => {
        const readThingThroughOthers = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: async () => [await readThingTwice({}), await readThing({ params: { id: 1 } })],
        })

        await MapLocalCache.begin(() => readThingThroughOthers({ session: reader }))

        expect(runs).toHaveBeenCalledTimes(1)
    })

    test('is not asked inside a transaction, whether it was begun outside the transaction or inside it', async () => {
        const readThingInTransaction = defineOperation({
            read: true,
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
        const readTwiceIn = (tx: Prisma.TransactionClient) => async () => {
            await readThing({ params: { id: 1 }, session: reader, prisma: tx })
            await readThing({ params: { id: 1 }, session: reader, prisma: tx })
        }

        await MapLocalCache.begin(() => prisma.$transaction(tx => readTwiceIn(tx)()))
        expect(runs).toHaveBeenCalledTimes(2)

        await prisma.$transaction(tx => MapLocalCache.begin(readTwiceIn(tx)))
        expect(runs).toHaveBeenCalledTimes(4)

        // Once outside the transaction and remembered there, and twice inside it.
        await MapLocalCache.begin(() => readThingInTransaction({ session: reader }))
        expect(runs).toHaveBeenCalledTimes(7)
    })

    test('is refused when it answers with what the operation never read', async () => {
        class AnswersForAnother extends LocalCache {
            public remember() {
                return Promise.resolve({ id: 1, readFor: 'cache-berit' })
            }

            protected clearOwn() {}
        }

        await expect(AnswersForAnother.begin(readThingOnce))
            .rejects.toMatchObject({ errorCode: 'SERVER ERROR' })
        expect(runs).not.toHaveBeenCalled()
    })

    test('is left alone by what runs with none in force, which reads fresh and clears nothing', async () => {
        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await LocalCache.withNone(async () => {
                await readThingOnce()
                await writeThing({ params: { id: 2 }, session: reader })
            })
            expect(runs).toHaveBeenCalledTimes(3)

            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(3)
        })
    })
})

describe('a local cache begun inside another', () => {
    const write = defineOperation({
        read: false,
        authorizer: () => Require.nothing(),
        operation: () => null,
    })

    test('answers the reads inside it, and the outer one those around it', async () => {
        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await MapLocalCache.begin(() => readThingTwice({ session: reader }))
            await readThingOnce()
        })

        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('is cleared by a write inside it, with every one it was begun inside of', async () => {
        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await MapLocalCache.begin(async () => {
                await readThingOnce()
                await MapLocalCache.begin(async () => {
                    await readThingOnce()
                    await write({})
                })
                expect(runs).toHaveBeenCalledTimes(3)
                await readThingOnce()
            })
            expect(runs).toHaveBeenCalledTimes(4)
            await readThingOnce()
        })

        expect(runs).toHaveBeenCalledTimes(5)
    })

    test('is not cleared by a write outside it, once it has ended', async () => {
        const cleared = jest.fn()
        class CountsClearings extends MapLocalCache {
            protected clearOwn() {
                cleared()
                super.clearOwn()
            }
        }

        await MapLocalCache.begin(async () => {
            await CountsClearings.begin(readThingOnce)
            await write({})
        })

        expect(cleared).not.toHaveBeenCalled()
    })
})

describe('a sub-operation', () => {
    const ownershipChecks = jest.fn()
    const readPart = defineSubOperation({
        paramsSchema: () => z.object({ id: z.number() }),
        read: false,
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
    const remembered = readPart.implement({ ...implementation, read: true })
    const fresh = readPart.implement(implementation)

    beforeEach(() => {
        ownershipChecks.mockClear()
    })

    test('is a read to the implementation that says so, with its ownership check, and to no other', async () => {
        await MapLocalCache.begin(async () => {
            await remembered({ params: { id: 1 }, implementationParams: { ownerId: 1 } })
            await remembered({ params: { id: 1 }, implementationParams: { ownerId: 1 } })
            expect(runs).toHaveBeenCalledTimes(1)
            expect(ownershipChecks).toHaveBeenCalledTimes(1)

            await fresh({ params: { id: 1 }, implementationParams: { ownerId: 1 } })
            await fresh({ params: { id: 1 }, implementationParams: { ownerId: 1 } })
            expect(runs).toHaveBeenCalledTimes(3)
        })
    })

    test('is read again for other implementation params', async () => {
        await MapLocalCache.begin(async () => {
            await remembered({ params: { id: 1 }, implementationParams: { ownerId: 1 } })
            await remembered({ params: { id: 1 }, implementationParams: { ownerId: 2 } })
        })

        expect(runs).toHaveBeenCalledTimes(2)
    })
})

describe('a sub-operation that says it is a read where it is defined', () => {
    const readPart = defineSubOperation({
        paramsSchema: () => z.object({ id: z.number() }),
        read: true,
        operation: (fields: { times: number } | undefined) => ({ params, prisma: client }) => {
            runs()
            return { answer: params.id * (fields?.times ?? 1), inTransaction: !isPrismaClient(client) }
        },
    })
    const implementation = { authorizer: () => Require.nothing(), ownershipCheck: () => true }
    const once = { operationImplementationFields: undefined, params: { id: 1 } }

    test('is remembered by its internal calls, which share their answers with no implementation', async () => {
        await MapLocalCache.begin(async () => {
            expect(await readPart.internalCall(once)).toBe(await readPart.internalCall(once))
            expect(runs).toHaveBeenCalledTimes(1)

            await readPart.internalCall({ ...once, params: { id: 2 } })
            const implemented = readPart.implement({ ...implementation, operationImplementationFields: undefined })
            await implemented({ params: { id: 1 } })
            expect(runs).toHaveBeenCalledTimes(3)
        })
    })

    test('is read every time by an internal call with no cache in force, and by one handed a transaction', async () => {
        await readPart.internalCall(once)
        await readPart.internalCall(once)
        expect(runs).toHaveBeenCalledTimes(2)

        await MapLocalCache.begin(async () => {
            await readPart.internalCall(once)
            await prisma.$transaction(async tx => {
                expect(await readPart.internalCall({ ...once, prisma: tx })).toMatchObject({ inTransaction: true })
            })
        })
        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('internal calls implemented with other fields do not share an answer', async () => {
        const twice = { ...once, operationImplementationFields: { times: 2 } }

        await MapLocalCache.begin(async () => {
            expect(await readPart.internalCall(twice)).toMatchObject({ answer: 2 })
            expect(await readPart.internalCall(once)).toMatchObject({ answer: 1 })
            expect(await readPart.internalCall(twice)).toMatchObject({ answer: 2 })
        })
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('the implementation decides: one that says no reads every time, one that says nothing is a read', async () => {
        const fresh = readPart.implement({ ...implementation, operationImplementationFields: undefined, read: false })
        const asDefined = readPart.implement({ ...implementation, operationImplementationFields: undefined })

        await MapLocalCache.begin(async () => {
            await fresh({ params: { id: 1 } })
            await fresh({ params: { id: 1 } })
            expect(runs).toHaveBeenCalledTimes(2)

            await asDefined({ params: { id: 1 } })
            await asDefined({ params: { id: 1 } })
            expect(runs).toHaveBeenCalledTimes(3)
        })
    })
})

describe('a call that is not a read', () => {
    const write = defineOperation({
        paramsSchema: z.object({ fails: z.boolean() }),
        read: false,
        authorizer: () => Require.nothing(),
        operation: ({ params }) => {
            if (params.fails) throw new Error('The write failed')
        },
    })
    const writeInItsOwnTransaction = defineOperation({
        transaction: 'RUNS_IN',
        read: false,
        authorizer: () => Require.nothing(),
        operation: ({ prisma: client }) => !isPrismaClient(client),
    })
    const writePart = defineSubOperation({
        read: false,
        operation: () => () => null,
    })
    const readThenWrite = defineOperation({
        read: true,
        authorizer: () => Require.nothing(),
        operation: async () => {
            runs()
            await write({ params: { fails: false } })
        },
    })

    test('clears the cache in force when it ends, so what is read after a write is read again', async () => {
        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(1)

            await write({ params: { fails: false } })
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(2)
        })
    })

    test('clears the cache when it throws, and when it runs in a transaction of its own', async () => {
        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await expect(write({ params: { fails: true } })).rejects.toMatchObject({ errorCode: 'UNKNOWN ERROR' })
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(2)

            expect(await writeInItsOwnTransaction({})).toBe(true)
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(3)
        })
    })

    test('clears also what the read that called it was kept as', async () => {
        await MapLocalCache.begin(async () => {
            await readThenWrite({})
            await readThenWrite({})
        })
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('a read under way when it ends is not what a later call is answered with', async () => {
        const reading = gate()
        const writing = gate()
        const readSlowly = defineOperation({
            paramsSchema: z.object({ started: z.enum(['before the write', 'during the write']) }),
            read: true,
            authorizer: () => Require.nothing(),
            operation: async () => {
                runs()
                await reading.opened
                return runs.mock.calls.length
            },
        })
        const writeSlowly = defineOperation({
            read: false,
            authorizer: () => Require.nothing(),
            operation: () => writing.opened,
        })

        await MapLocalCache.begin(async () => {
            const startedBefore = readSlowly({ params: { started: 'before the write' } })
            const written = writeSlowly({})
            const startedDuring = readSlowly({ params: { started: 'during the write' } })
            writing.open()
            await written

            const after = [
                readSlowly({ params: { started: 'before the write' } }),
                readSlowly({ params: { started: 'during the write' } }),
            ]
            reading.open()
            await Promise.all([startedBefore, startedDuring, ...after])
        })

        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('remembers nothing while it runs, so it reads what it wrote', async () => {
        const readWriteRead = defineOperation({
            read: false,
            authorizer: () => Require.nothing(),
            operation: async () => {
                await readThing({ params: { id: 1 } })
                await readThing({ params: { id: 1 } })
            },
        })

        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await readWriteRead({ session: reader })
        })

        expect(runs).toHaveBeenCalledTimes(3)
    })

    test('in a transaction clears the cache in force, whether a call or the context holds the transaction', async () => {
        const repairInTransaction = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: ({ prisma: client }) => client.$transaction(tx => writePart.internalCall({ prisma: tx })),
        })
        const writeInTransaction = defineOperation({
            transaction: 'OPENS',
            read: false,
            authorizer: () => Require.nothing(),
            operation: ({ prisma: client }) => client.$transaction(tx => writePart.internalCall({ prisma: tx })),
        })

        await MapLocalCache.begin(async () => {
            await readThingOnce()
            await repairInTransaction({})
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(2)

            await writeInTransaction({})
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(3)

            await prisma.$transaction(tx => withServiceContext({ prisma: tx }, 'NONE', () => writePart.internalCall({})))
            await readThingOnce()
            expect(runs).toHaveBeenCalledTimes(4)
        })
    })

    test('is not what a read with params that cannot be compared is: such a read clears nothing', async () => {
        const readByTags = defineOperation({
            paramsSchema: z.object({ tags: z.set(z.string()) }),
            read: true,
            authorizer: () => Require.nothing(),
            operation: ({ params }) => params.tags.size,
        })
        const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger)

        await MapLocalCache.begin(async () => {
            await readThingOnce()
            expect(await readByTags({ params: { tags: new Set(['a']) } })).toBe(1)
            await readThingOnce()
        })

        expect(runs).toHaveBeenCalledTimes(1)
        warn.mockRestore()
    })
})

describe('what is read after a write', () => {
    let stored = 0
    const value = z.object({ value: z.number() })
    const readStored = defineOperation({
        read: true,
        authorizer: () => Require.nothing(),
        operation: () => ({ stored }),
    })
    const store = defineOperation({
        dataSchema: value,
        read: false,
        authorizer: () => Require.nothing(),
        operation: ({ data }) => {
            stored = data.value
        },
    })
    const storePart = defineSubOperation({
        dataSchema: () => value,
        read: false,
        operation: () => ({ data }) => {
            stored = data.value
        },
    })
    const storeImplemented = storePart.implement({ authorizer: () => Require.nothing(), ownershipCheck: () => true })
    const storeInTransaction = defineOperation({
        dataSchema: value,
        transaction: 'RUNS_IN',
        read: false,
        authorizer: () => Require.nothing(),
        operation: ({ data }) => {
            stored = data.value
        },
    })
    const writes: [string, (data: { value: number }) => Promise<unknown>][] = [
        ['an operation', data => store({ data })],
        ['an implemented sub-operation', data => storeImplemented({ data })],
        ['an internal call', data => storePart.internalCall({ data })],
        ['an operation that runs in a transaction', data => storeInTransaction({ data })],
    ]

    test.each(writes)('is what was written by %s', async (kind, write) => {
        stored = 1

        await MapLocalCache.begin(async () => {
            expect(await readStored({})).toEqual({ stored: 1 })
            await write({ value: 2 })
            expect(await readStored({})).toEqual({ stored: 2 })
        })
    })
})

describe('the key of a call', () => {
    test('is the same for values that are equal, whatever order their fields were written in', () => {
        const key = localCacheKey({ id: 1, filter: { tag: 'a', from: new Date(5) }, ids: [1, 2] })

        expect(localCacheKey({ ids: [1, 2], filter: { from: new Date(5), tag: 'a' }, id: 1 })).toBe(key)
        expect(key).toBeDefined()
    })

    test('differs for values that differ, also those JSON writes alike', () => {
        const different = [
            null, undefined, 'null', 'undefined', 0, '0', BigInt(0), false, 'false', NaN, [], {}, [null], [undefined], [[]],
            { id: null }, { id: undefined }, { id: 1 }, { id: '1' }, { id: [1] }, { di: 1 },
            new Date(0), '1970-01-01T00:00:00.000Z', 'Date(0)',
            [1, [2]], [[1], 2], [1, 2], ['1,2'], ['1', '2'], { id: { tag: 1 } }, { 'id.tag': 1 }, { id: 1, tag: 1 },
        ]

        const keys = different.map(localCacheKey)

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

        expect(incomparable.map(localCacheKey)).toEqual(incomparable.map(() => undefined))
    })

    test('is missing for a value that holds itself or has a symbol for a field, and not for one held twice', () => {
        const holdsItself: { id: number, self?: unknown } = { id: 1 }
        holdsItself.self = [holdsItself]
        const heldTwice = { tag: 'a' }

        expect(localCacheKey(holdsItself)).toBeUndefined()
        expect(localCacheKey({ id: 1, [Symbol('hidden')]: 2 })).toBeUndefined()
        expect(localCacheKey({ first: heldTwice, second: heldTwice }))
            .toBe(localCacheKey({ first: { tag: 'a' }, second: { tag: 'a' } }))
    })
})

/**
 * `read` must be said, and `read: true` is refused on what the compiler can see is no read. The
 * `@ts-expect-error` lines are the test of that: `tsc` fails on any of them that stops being an
 * error. Each refused operation is then called, since a `read: true` that got past the compiler
 * must not be honoured either.
 */
describe('the types of read', () => {
    const data = z.object({ name: z.string() })
    const implementation = { authorizer: () => Require.nothing(), ownershipCheck: () => true }

    test('it does not compile left out, and such an operation is no read', async () => {
        // @ts-expect-error - an operation says whether it is a read
        const unsaid = defineOperation({
            authorizer: () => Require.nothing(),
            operation: () => runs(),
        })
        // @ts-expect-error - a sub-operation says whether it is a read
        const unsaidPart = defineSubOperation({
            operation: () => () => runs(),
        })

        await MapLocalCache.begin(async () => {
            await unsaid({})
            await unsaid({})
            await unsaidPart.internalCall({})
            await unsaidPart.internalCall({})
        })

        expect(runs).toHaveBeenCalledTimes(4)
    })

    test('it does not compile as true on an operation with a data schema, and such a call is never remembered', async () => {
        const writeName = defineOperation({
            dataSchema: data,
            // @ts-expect-error - an operation that takes data is no read
            read: true,
            authorizer: () => Require.nothing(),
            operation: ({ data: { name } }) => name,
        })
        const writeNameOfPart = defineSubOperation({
            dataSchema: () => data,
            read: false,
            operation: () => ({ data: { name } }) => name,
        }).implement({
            ...implementation,
            // @ts-expect-error - an operation that takes data is no read
            read: true,
        })

        await MapLocalCache.begin(async () => {
            for (const write of [writeName, writeNameOfPart]) {
                expect(await write({ data: { name: 'first' } })).toBe('first')
                expect(await write({ data: { name: 'second' } })).toBe('second')
            }
        })
    })

    test('it does not compile as true on an operation that opens or runs in a transaction, which keeps it', async () => {
        const inTransaction = defineOperation({
            transaction: 'RUNS_IN',
            // @ts-expect-error - what runs in a transaction writes
            read: true,
            authorizer: () => Require.nothing(),
            operation: ({ prisma: client }) => !isPrismaClient(client),
        })
        const inTransactionOfPart = defineSubOperation({
            transaction: 'RUNS_IN',
            read: false,
            operation: () => ({ prisma: client }) => !isPrismaClient(client),
        }).implement({
            ...implementation,
            // @ts-expect-error - what runs in a transaction writes
            read: true,
        })
        const opensTransaction = defineOperation({
            transaction: 'OPENS',
            // @ts-expect-error - what opens a transaction writes
            read: true,
            authorizer: () => Require.nothing(),
            operation: () => runs(),
        })

        await MapLocalCache.begin(async () => {
            expect(await inTransaction({})).toBe(true)
            expect(await inTransactionOfPart({})).toBe(true)
            await opensTransaction({})
            await opensTransaction({})
        })
        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('it compiles as true on an operation with neither, also one that says it has no transaction', () => {
        const operations = [
            defineOperation({ read: true, authorizer: () => Require.nothing(), operation: () => null }),
            defineOperation({
                transaction: 'NONE',
                read: true,
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
            read: false,
            operation: () => ({ prisma: client }) => !isPrismaClient(client),
        })
        // Made beforehand, since an object written in the call is refused for any field the call does not know.
        const args = { data: { name: 'first' }, read: true }

        // @ts-expect-error - an internal call does not say whether it is a read
        const wasInTransaction = await write.internalCall(args)

        expect(wasInTransaction).toBe(true)
    })

    test('an internal call that is handed it past the compiler does not decide', async () => {
        const write = defineSubOperation({
            read: false,
            operation: () => () => {
                runs()
                return 1
            },
        })
        const args = { read: true }

        await MapLocalCache.begin(async () => {
            // @ts-expect-error - an internal call does not say whether it is a read
            await write.internalCall(args)
            // @ts-expect-error - an internal call does not say whether it is a read
            await write.internalCall(args)
        })

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

describe('the reads of the services', () => {
    test('a profile is read again after the read that repaired its omega membership, and then once', async () => {
        const readProfileAs = (user: UserFiltered) => userOperations.readProfile({
            params: { username: anne.username },
            session: testSession({ user }),
        })

        await MapLocalCache.begin(async () => {
            const repaired = await readProfileAs(anne)
            const profile = await readProfileAs(anne)
            expect(profile).not.toBe(repaired)
            expect(profile).toEqual(repaired)

            await prisma.user.update({ where: { id: anne.id }, data: { firstname: 'Anne Etterpå' } })
            const again = await readProfileAs(anne)
            const fresh = await LocalCache.withNone(() => readProfileAs(anne))

            expect(again).toBe(profile)
            expect(fresh.user.firstname).toBe('Anne Etterpå')
            await expect(readProfileAs(berit)).rejects.toMatchObject({ errorCode: 'UNAUTHORIZED' })
        })
    })

    test('a special link that is missing is created once by reads made at the same time', async () => {
        await prisma.cmsLink.deleteMany({ where: { special: 'CAREER_CONTACT' } })

        const links = await MapLocalCache.begin(() => Promise.all([1, 2, 3].map(() => (
            careersFrontpageOperations.cmsLinks.read({ params: { special: 'CAREER_CONTACT' }, session: visitor })
        ))))

        expect(new Set(links.map(link => link.id)).size).toBe(1)
        expect(await prisma.cmsLink.count({ where: { special: 'CAREER_CONTACT' } })).toBe(1)
    })

    test('a special event tag that is missing is made by a read, which clears what was read before it', async () => {
        await prisma.eventTagEvent.deleteMany({ where: { tag: { special: 'COMPANY_PRESENTATION' } } })
        await prisma.eventTag.deleteMany({ where: { special: 'COMPANY_PRESENTATION' } })
        const readSpecial = () => eventTagOperations.readSpecial({
            params: { special: 'COMPANY_PRESENTATION' },
            bypassAuth: true,
        })

        await MapLocalCache.begin(async () => {
            const tagsBefore = await eventTagOperations.readAll({ bypassAuth: true })
            const made = await readSpecial()
            const tagsAfter = await eventTagOperations.readAll({ bypassAuth: true })

            expect(tagsBefore.map(tag => tag.id)).not.toContain(made.id)
            expect(tagsAfter.map(tag => tag.id)).toContain(made.id)
            expect(await readSpecial()).toBe(await readSpecial())
        })
    })

    test('an api key is read once, and again after the read that deactivated it as expired', async () => {
        const { id } = await prisma.apiKey.create({ data: { name: 'cache key', keyHashEncrypted: 'none', active: true } })
        const read = () => apiKeyOperations.read({ params: { id }, bypassAuth: true })

        await MapLocalCache.begin(async () => expect(await read()).toBe(await read()))
        await prisma.apiKey.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })

        await MapLocalCache.begin(async () => {
            const deactivated = await read()
            const again = await read()
            expect(deactivated.active).toBe(false)
            expect(again).not.toBe(deactivated)
            expect(await read()).toBe(again)
        })
    })

    test('a standard image and its collection are read once under a local cache', async () => {
        await MapLocalCache.begin(() => withServiceContext({ session: visitor }, 'NONE', async () => {
            const readLogo = () => standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'LOGO_SIMPLE' },
            })
            const logo = await readLogo()
            const collection = await standardImageCollection.internal.read.internalCall({})

            expect(await readLogo()).toBe(logo)
            expect(await standardImageCollection.internal.read.internalCall({})).toBe(collection)
        }))
    })

    test('the owner matrices behind the mail server nav items are read once under a local cache', async () => {
        await MapLocalCache.begin(() => withServiceContext({ session: visitor }, 'NONE', async () => {
            expect(await readAliasOwnerMatrices.internalCall({})).toBe(await readAliasOwnerMatrices.internalCall({}))
            expect(await readMailingListOwnerMatrices.internalCall({}))
                .toBe(await readMailingListOwnerMatrices.internalCall({}))
        }))
    })
})

describe('what the page of an event reads', () => {
    const HOUR = 60 * 60 * 1000
    let groupId: number
    let committeeId: number
    let committeeGroupId: number

    beforeAll(async () => {
        const { order } = await prisma.omegaOrder.findFirstOrThrow({ orderBy: { order: 'desc' } })
        groupId = (await prisma.group.create({
            data: {
                groupType: 'MANUAL_GROUP',
                order,
                manualGroup: { create: { name: 'cache admins', shortName: 'cacheadm' } },
            },
        })).id
        const committee = await prisma.committee.create({
            data: {
                name: 'Cache committee',
                shortName: 'cachecom',
                group: { create: { groupType: 'COMMITTEE', order } },
                committeeArticle: { create: { name: 'cachecom', coverImage: { create: {} } } },
                paragraph: { create: {} },
            },
        })
        committeeId = committee.id
        committeeGroupId = committee.groupId
    })

    const createDraft = (name: string) => eventOperations.create({
        data: {
            name,
            location: 'Lophtet',
            eventStart: new Date(Date.now() + 48 * HOUR),
            eventEnd: new Date(Date.now() + 50 * HOUR),
            takesRegistration: true,
            places: 5,
            waitingList: false,
            registrationStart: new Date(Date.now() - HOUR),
            registrationEnd: new Date(Date.now() + 24 * HOUR),
            quotaVisibilityRequirements: [],
            visibilityAdminRequirements: [{ conditions: [activeMembersOf(groupId)] }],
        },
        bypassAuth: true,
    })

    test('the access of an event is remembered where a local cache is in force, and read fresh by a sign-up', async () => {
        const event = await createDraft('Husket tilgang')
        const signUp = { params: { eventId: event.id, userId: anne.id }, session: testSession({ user: anne }) }
        const readAccess = () => readEventAccess.internalCall({ params: { id: event.id } })

        await MapLocalCache.begin(async () => {
            const access = await readAccess()
            // Run with no cache in force, so the refused sign-up does not clear the access just read.
            await expect(LocalCache.withNone(() => eventRegistrationOperations.create(signUp))).rejects.toThrow(Smorekopp)
            await prisma.event.update({ where: { id: event.id }, data: { published: true } })

            expect(await readAccess()).toBe(access)
            await expect(eventRegistrationOperations.create(signUp)).resolves.toMatchObject({ userId: anne.id })
        })
    })

    test('the access is read fresh in the transaction of a save that changes who administrates the event', async () => {
        const event = await createDraft('Uten administratorer')
        const { order } = await prisma.group.findUniqueOrThrow({ where: { id: groupId } })
        const administrator = testSession({ memberships: [{ groupId, order, active: true, admin: false }] })

        // The save's authorizer reads the access before the save takes the administrators away. The
        // host is adopted only if the save then sees that no one is left.
        await MapLocalCache.begin(() => eventOperations.saveSetup({
            params: { id: event.id },
            data: { adminRequirements: [{ conditions: [] }], hostedByCommitteeId: committeeId },
            session: administrator,
        }))

        const matrix = await eventOperations.adminVisibility.readMatrix({ params: { id: event.id }, bypassAuth: true })
        expect(matrix.requirements.map(requirement => requirement.conditions.map(condition => condition.groupId)))
            .toEqual([[committeeGroupId]])
    })
})

describe('a page reads, an action writes and the next render reads again', () => {
    test('a profile shows the name its user was given', async () => {
        const asAnne = testSession({ user: anne })
        const readProfile = () => userOperations.readProfile({ params: { username: anne.username }, session: asAnne })

        await MapLocalCache.begin(readProfile)
        await userOperations.update({ params: { id: anne.id }, data: { firstname: 'Anne Endret' }, bypassAuth: true })

        expect((await MapLocalCache.begin(readProfile)).user.firstname).toBe('Anne Endret')
    })

    test('a special link shows the text it was given', async () => {
        const readLink = () => careersFrontpageOperations.cmsLinks.read({
            params: { special: 'CAREER_CONTACT' },
            session: visitor,
        })

        const before = await MapLocalCache.begin(readLink)
        await careersFrontpageOperations.cmsLinks.update({
            params: { linkId: before.id },
            data: { text: 'Skriv til oss' },
            bypassAuth: true,
        })

        expect((await MapLocalCache.begin(readLink)).text).toBe('Skriv til oss')
    })

    test('the event tags hold the one that was made', async () => {
        const readTags = () => eventTagOperations.readAll({ session: visitor, bypassAuth: true })

        await MapLocalCache.begin(readTags)
        const made = await eventTagOperations.create({
            data: { name: 'Husket merkelapp', description: '', color: '#aa0000' },
            bypassAuth: true,
        })

        expect((await MapLocalCache.begin(readTags)).map(tag => tag.id)).toContain(made.id)
    })
})

function gate() {
    let open = () => {}
    const opened = new Promise<void>(resolve => {
        open = resolve
    })
    return { opened, open: () => open() }
}
