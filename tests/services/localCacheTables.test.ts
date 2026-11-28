import { Require } from '@/auth/authorizer/Require'
import { prisma } from '@/prisma-pn-client-instance'
import { LocalCache, MapLocalCache } from '@/services/localCache'
import { defineOperation } from '@/services/serviceOperation'
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { Prisma } from '@/prisma-generated-pn-client'
import type { TransactionFlag } from '@/services/serviceOperation'

type Client = Prisma.TransactionClient

const reads = {
    quotes: countedRead(client => client.omegaQuote.count()),
    licenses: countedRead(client => client.license.count()),
    images: countedRead(client => client.image.count()),
    paragraphs: countedRead(client => client.cmsParagraph.count()),
    credentials: countedRead(client => client.credentials.count()),
    usersWithFlairs: countedRead(client => client.user.count({ where: { flairs: { some: {} } } })),
    rawSql: countedRead(client => client.$queryRaw`SELECT count(*)::int FROM "OmegaQuote"`),
    noTable: countedRead(() => Promise.resolve('read from another system')),
}
type ReadName = keyof typeof reads

const writeQuotes = (client: Client) => client.omegaQuote.updateMany({ where: { id: -1 }, data: { quote: 'none' } })
const newUser = (username: string): Prisma.UserCreateInput => ({
    username,
    email: `${username}@omega.ntnu.no`,
    bioParagraph: { create: {} },
    ledgerAccount: { create: { type: 'USER' } },
})

let licenseId: number
let userToDeleteId: number
let userWithFlairsId: number

beforeAll(async () => {
    licenseId = (await prisma.license.create({ data: { name: 'Cache license', link: 'https://license.test' } })).id
    userToDeleteId = (await prisma.user.create({ data: newUser('cache-tables-deleted') })).id
    userWithFlairsId = (await prisma.user.create({ data: newUser('cache-tables-flairs') })).id
})

beforeEach(() => {
    Object.values(reads).forEach(read => read.runs.mockClear())
})

describe('read, write, read', () => {
    const writes: [string, TransactionFlag, (client: Client) => Promise<unknown>, ReadName[]][] = [
        ['a plain update', 'NONE', writeQuotes, ['quotes']],
        ['a nested write', 'NONE', client => client.user.create({ data: newUser('cache-tables-made') }), [
            'paragraphs', 'usersWithFlairs',
        ]],
        ['a delete the database cascades', 'NONE', client => client.user.delete({ where: { id: userToDeleteId } }), [
            'credentials', 'usersWithFlairs',
        ]],
        ['a change of a key other rows refer to', 'NONE', client => client.license.update({
            where: { id: licenseId },
            data: { link: 'https://license.test/moved' },
        }), ['licenses', 'images']],
        ['a write to an implicit many-to-many', 'NONE', client => client.user.update({
            where: { id: userWithFlairsId },
            data: { flairs: { set: [] } },
        }), ['usersWithFlairs']],
        ['an operation that runs in a transaction', 'RUNS_IN', writeQuotes, ['quotes']],
        ['raw SQL', 'NONE', client => client.$executeRaw`SELECT 1`, [
            'quotes', 'licenses', 'images', 'paragraphs', 'credentials', 'usersWithFlairs',
        ]],
    ]

    test.each(writes)('%s makes unusable the answers of the tables it wrote, and no others', async (
        kind, transaction, write, written
    ) => {
        const writeIt = defineOperation({
            transaction,
            read: false,
            authorizer: () => Require.nothing(),
            operation: ({ prisma: client }) => write(client),
        })
        const tableReads: ReadName[] = ['quotes', 'licenses', 'images', 'paragraphs', 'credentials', 'usersWithFlairs']

        await MapLocalCache.begin(async () => {
            await readAll(tableReads)
            await writeIt({})
            await readAll(tableReads)
        })

        expect(tableReads.filter(name => reads[name].runs.mock.calls.length === 2)).toEqual(written)
    })

    test('a transaction makes them unusable when it has committed, and not before', async () => {
        await MapLocalCache.begin(async () => {
            await readAll(['quotes', 'licenses'])
            await prisma.$transaction(async tx => {
                await writeQuotes(tx)
                await readAll(['quotes'])
                expect(reads.quotes.runs).toHaveBeenCalledTimes(1)
            })
            await readAll(['quotes', 'licenses'])
        })

        expect(reads.quotes.runs).toHaveBeenCalledTimes(2)
        expect(reads.licenses.runs).toHaveBeenCalledTimes(1)
    })

    test('a write a transaction set off and left running is told when it is done, after the transaction', async () => {
        await MapLocalCache.begin(async () => {
            await readAll(['quotes'])
            let late: Promise<unknown> = Promise.resolve()
            await prisma.$transaction(async tx => {
                await tx.license.count()
                late = new Promise(resolve => {
                    setTimeout(resolve, 20)
                }).then(() => writeQuotes(prisma))
            })
            await late
            await readAll(['quotes'])
        })

        expect(reads.quotes.runs).toHaveBeenCalledTimes(2)
    })

    test('a transaction that is rolled back makes them unusable too', async () => {
        await MapLocalCache.begin(async () => {
            await readAll(['quotes', 'licenses'])
            await expect(prisma.$transaction(async tx => {
                await writeQuotes(tx)
                throw new Error('rolled back')
            })).rejects.toThrow('rolled back')
            await readAll(['quotes', 'licenses'])
        })

        expect(reads.quotes.runs).toHaveBeenCalledTimes(2)
        expect(reads.licenses.runs).toHaveBeenCalledTimes(1)
    })
})

describe('an answer that read no table, or tables that cannot be told', () => {
    const writeElsewhere = defineOperation({
        read: false,
        authorizer: () => Require.nothing(),
        operation: () => 'written to another system',
    })

    test('is not given again after something that is not a read, which leaves those that read a table', async () => {
        await MapLocalCache.begin(async () => {
            await readAll(['noTable', 'rawSql', 'licenses'])
            await readAll(['noTable', 'rawSql', 'licenses'])
            await writeElsewhere({})
            await readAll(['noTable', 'rawSql', 'licenses'])
        })

        expect(reads.noTable.runs).toHaveBeenCalledTimes(2)
        expect(reads.rawSql.runs).toHaveBeenCalledTimes(2)
        expect(reads.licenses.runs).toHaveBeenCalledTimes(1)
    })

    test('is asked for by a read of a table, whose answer is then not given again either', async () => {
        const runs = jest.fn()
        const readBoth = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: async ({ prisma: client }) => {
                runs()
                return [await client.license.count(), await reads.noTable.read()]
            },
        })

        await MapLocalCache.begin(async () => {
            await readBoth({})
            await readBoth({})
            await writeElsewhere({})
            await readBoth({})
        })

        expect(runs).toHaveBeenCalledTimes(2)
    })

    test('is not given again after a write to any table', async () => {
        await MapLocalCache.begin(async () => {
            await readAll(['rawSql', 'licenses'])
            await writeQuotes(prisma)
            await readAll(['rawSql', 'licenses'])
        })

        expect(reads.rawSql.runs).toHaveBeenCalledTimes(2)
        expect(reads.licenses.runs).toHaveBeenCalledTimes(1)
    })
})

describe('a read that calls a read', () => {
    test('is not given again after a write to a table of the read it called, which the cache answered', async () => {
        const outerRuns = jest.fn()
        const readThroughAnother = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: async () => {
                outerRuns()
                return { quotes: await reads.quotes.read() }
            },
        })

        await MapLocalCache.begin(async () => {
            await reads.quotes.read()
            await readThroughAnother({})
            expect(reads.quotes.runs).toHaveBeenCalledTimes(1)

            await prisma.license.updateMany({ where: { id: -1 }, data: { link: 'none' } })
            await readThroughAnother({})
            expect(outerRuns).toHaveBeenCalledTimes(1)

            await writeQuotes(prisma)
            await readThroughAnother({})
            expect(outerRuns).toHaveBeenCalledTimes(2)
        })
    })
})

describe('a read under way when a write ends', () => {
    let reading = gate()
    let waiting = gate()
    const slowRuns = jest.fn()
    const readSlowly = defineOperation({
        read: true,
        authorizer: () => Require.nothing(),
        operation: async ({ prisma: client }) => {
            slowRuns()
            const quotes = await client.omegaQuote.count()
            waiting.open()
            await reading.opened
            return quotes
        },
    })

    beforeEach(() => {
        reading = gate()
        waiting = gate()
        slowRuns.mockClear()
    })

    test('is what a later call is answered with when the write was to a table it did not read', async () => {
        await MapLocalCache.begin(async () => {
            const underWay = readSlowly({})
            await prisma.license.updateMany({ where: { id: -1 }, data: { link: 'none' } })
            reading.open()
            await underWay
            await readSlowly({})
        })

        expect(slowRuns).toHaveBeenCalledTimes(1)
    })

    test('is not what a later call is answered with when the write was to a table it read', async () => {
        await MapLocalCache.begin(async () => {
            const underWay = readSlowly({})
            await writeQuotes(prisma)
            reading.open()
            await underWay
            await readSlowly({})
        })

        expect(slowRuns).toHaveBeenCalledTimes(2)
    })

    test('is not what a call is answered with while it is under way, when it waits for a read of that table', async () => {
        const outerRuns = jest.fn()
        const readLicensesAndSlowly = defineOperation({
            read: true,
            authorizer: () => Require.nothing(),
            operation: async ({ prisma: client }) => {
                outerRuns()
                await client.license.count()
                return await readSlowly({})
            },
        })

        await MapLocalCache.begin(async () => {
            const underWay = readLicensesAndSlowly({})
            await waiting.opened
            await writeQuotes(prisma)
            const askedAfterTheWrite = readLicensesAndSlowly({})
            reading.open()
            await Promise.all([underWay, askedAfterTheWrite])
        })

        expect(outerRuns).toHaveBeenCalledTimes(2)
        expect(slowRuns).toHaveBeenCalledTimes(2)
    })
})

describe('a write three caches deep', () => {
    const both: ReadName[] = ['quotes', 'licenses']
    const writeInACacheOfItsOwn = () => MapLocalCache.begin(async () => await writeQuotes(prisma))
    const readWriteReadAtDepth = (depth: number): Promise<void> => MapLocalCache.begin(async () => {
        await readAll(both)
        await (depth > 1 ? readWriteReadAtDepth(depth - 1) : writeQuotes(prisma))
        await readAll(both)
    })

    test('makes the answers of its table unusable in all three, and leaves the others', async () => {
        await readWriteReadAtDepth(3)

        expect(reads.quotes.runs).toHaveBeenCalledTimes(6)
        expect(reads.licenses.runs).toHaveBeenCalledTimes(3)
    })

    test('is told to them also from where no cache is asked', async () => {
        await MapLocalCache.begin(async () => {
            await readAll(both)
            await LocalCache.withNone(writeInACacheOfItsOwn)
            await readAll(both)
        })

        expect(reads.quotes.runs).toHaveBeenCalledTimes(2)
        expect(reads.licenses.runs).toHaveBeenCalledTimes(1)
    })
})

function countedRead(read: (client: Client) => Promise<unknown>) {
    const runs = jest.fn()
    const operation = defineOperation({
        read: true,
        authorizer: () => Require.nothing(),
        operation: async ({ prisma: client }) => {
            runs()
            return await read(client)
        },
    })
    return { read: () => operation({}), runs }
}

async function readAll(names: ReadName[]) {
    for (const name of names) await reads[name].read()
}

function gate() {
    let open = () => {}
    const opened = new Promise<void>(resolve => {
        open = resolve
    })
    return { opened, open: () => open() }
}
