import { tablesOfSql } from 'tests/tableWatchCheck'
import { tableMap } from '@/prisma-generated-table-map'
import { prisma } from '@/prisma-pn-client-instance'
import { tablesOfQuery } from '@/prisma/tableWatch/tablesOfQuery'
import { onTablesWritten, watchTablesRead } from '@/prisma/tableWatch/watch'
import { expandedImageCollectionIncluder, expandedImageIncluder } from '@/services/images/subservice/constants'
import { groupsExpandedIncluder } from '@/services/groups/constants'
import { flairOperations } from '@/services/flairs/operations'
import { describe, expect, jest, test } from '@jest/globals'
import type { Tables } from '@/prisma/tableWatch/tablesOfQuery'

const sorted = (tables: Tables) => (tables === 'unknown' ? tables : Array.from(tables).sort())
const tablesOf = (model: string | undefined, operation: string, args: unknown) => {
    const { read, written } = tablesOfQuery(model, operation, args)
    return { read: sorted(read), written: sorted(written) }
}

describe('the tables of a query', () => {
    test('include at any depth, with take, orderBy and _count', () => {
        expect(tablesOf('ImageCollection', 'findMany', { include: expandedImageCollectionIncluder })).toEqual({
            read: ['Image', 'ImageCollection', 'ProcessedImageFiles'], written: [],
        })
    })

    test('select of a relation, and a filter in a counted relation', () => {
        expect(tablesOf('Group', 'findMany', { include: groupsExpandedIncluder }).read).toEqual([
            'Class', 'Committee', 'Group', 'InterestGroup', 'ManualGroup', 'Membership', 'OmegaMembershipGroup',
            'RevueGroup', 'RevueSubGroup', 'StudyProgramme', 'User',
        ])
    })

    test('an implicit many-to-many names its join table, read and written', () => {
        expect(tablesOf('User', 'findUniqueOrThrow', {
            where: { id: 1 },
            select: { flairs: { include: { image: { include: expandedImageIncluder } } } },
        }).read).toEqual(['Flair', 'Image', 'ProcessedImageFiles', 'User', '_userFlairs'])
        expect(tablesOf('User', 'update', { where: { id: 1 }, data: { flairs: { disconnect: { id: 2 } } } }).written)
            .toEqual(['User', '_userFlairs'])
    })

    test('a relation filter in where and an orderBy on a relation', () => {
        expect(tablesOf('ChatUser', 'findUnique', {
            where: { userId: 1 },
            select: {
                spaceMemberships: {
                    where: { space: { destroyedAt: null } },
                    select: { space: { select: { committee: { select: { shortName: true } } } } },
                    orderBy: { space: { name: 'asc' } },
                },
            },
        }).read).toEqual(['ChatSpace', 'ChatSpaceMember', 'ChatUser', 'Committee'])
        expect(tablesOf('Event', 'findMany', {
            where: { OR: [{ eventTagEvents: { some: { tag: { name: 'x' } } } }, { NOT: { variants: { none: {} } } }] },
            orderBy: [{ hostedByCommittee: { name: 'asc' } }, { variants: { _count: 'desc' } }],
        }).read).toEqual(['Committee', 'Event', 'EventTag', 'EventTagEvent', 'EventVariant'])
    })

    test('nested writes, and a link that writes the table holding the key', () => {
        expect(tablesOf('User', 'create', {
            data: { username: 'a', email: 'b', bioParagraph: { create: {} }, ledgerAccount: { create: { type: 'USER' } } },
        }).written).toEqual(['CmsParagraph', 'LedgerAccount', 'User'])
        // The key is on the image, so the license's table is read and not written.
        expect(tablesOf('Image', 'update', { where: { id: 1 }, data: { license: { connect: { id: 2 } } } }))
            .toEqual({ read: ['Image', 'License'], written: ['Image'] })
    })

    test('what the database does on delete and on a change of a key', () => {
        const deleted = tablesOf('User', 'delete', { where: { id: 1 } }).written
        expect(deleted).toEqual(expect.arrayContaining([
            'User', 'Credentials', 'Membership', 'EventRegistration', '_userFlairs',
        ]))
        // A user's events are kept, with `createdById` set null.
        expect(deleted).toContain('Event')
        expect(tablesOf('MailAddress', 'update', { where: { address: 'a' }, data: { address: 'b' } }).written)
            .toEqual(['MailAddress', 'MailAlias', 'User'])
        const ordinary = { where: { address: 'a' }, data: { forwardsToPrivateEmail: true } }
        expect(tablesOf('MailAddress', 'update', ordinary).written).toEqual(['MailAddress'])
    })

    test('raw SQL and an operation it does not know are unknown', () => {
        expect(tablesOf(undefined, '$queryRaw', {})).toEqual({ read: 'unknown', written: [] })
        expect(tablesOf(undefined, '$executeRawUnsafe', {})).toEqual({ read: 'unknown', written: 'unknown' })
        expect(tablesOf('User', 'findManyByMagic', {})).toEqual({ read: 'unknown', written: 'unknown' })
    })
})

describe('the table map', () => {
    type ForeignKey = {
        from: string, to: string, columns: string[], referenced: string[], onDelete: string, onUpdate: string
    }
    const line = (key: ForeignKey) => [
        `${key.from}(${key.columns.join(',')}) -> ${key.to}(${key.referenced.join(',')})`,
        `on delete ${key.onDelete} on update ${key.onUpdate}`,
    ].join(' ')

    test('says of every foreign key what the database says', async () => {
        const inDatabase = await prisma.$queryRaw<ForeignKey[]>`
            WITH actions(code, action) AS (VALUES
                ('a', 'NoAction'), ('r', 'Restrict'), ('c', 'Cascade'), ('n', 'SetNull'), ('d', 'SetDefault')
            )
            SELECT f.relname AS "from", t.relname AS "to",
                (SELECT action FROM actions WHERE code = c.confdeltype::text) AS "onDelete",
                (SELECT action FROM actions WHERE code = c.confupdtype::text) AS "onUpdate",
                (SELECT array_agg(a.attname::text ORDER BY k.i) FROM unnest(c.conkey) WITH ORDINALITY k(n, i)
                    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS columns,
                (SELECT array_agg(a.attname::text ORDER BY k.i) FROM unnest(c.confkey) WITH ORDINALITY k(n, i)
                    JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n) AS referenced
            FROM pg_constraint c
            JOIN pg_class f ON f.oid = c.conrelid
            JOIN pg_class t ON t.oid = c.confrelid
            JOIN pg_namespace s ON s.oid = c.connamespace
            WHERE c.contype = 'f' AND s.nspname = current_schema()
        `
        const relations = Object.values(tableMap).flatMap(model => (
            Object.values(model.relations).map(relation => ({ from: model.table, relation }))
        ))
        const joinTables = new Set(relations.flatMap(({ relation }) => (
            relation.kind === 'manyToMany' ? [relation.joinTable] : []
        )))
        const ofMap = relations.flatMap(({ from, relation }) => (
            relation.kind === 'key' && relation.keyOn === 'this' ? [line({
                from,
                to: relation.table,
                columns: relation.keyColumns,
                referenced: relation.referencedColumns,
                onDelete: relation.onDelete,
                onUpdate: relation.onUpdate,
            })] : []
        ))

        expect(ofMap.sort()).toEqual(inDatabase.filter(key => !joinTables.has(key.from)).map(line).sort())
        expect(ofMap.length).toBeGreaterThan(150)

        // A join table refers to its two models and follows both on delete and on update.
        const ofJoinTables = inDatabase.filter(key => joinTables.has(key.from))
        expect(ofJoinTables).toHaveLength(joinTables.size * 2)
        expect(ofJoinTables.every(key => key.onDelete === 'Cascade' && key.onUpdate === 'Cascade')).toBe(true)
    })
})

describe('the check of the tables of a query', () => {
    test('finds the tables a statement reads and writes', () => {
        const upsert = 'INSERT INTO "public"."License" ("name") VALUES ($1) ON CONFLICT ("name") DO UPDATE SET "link" = $2'
        expect(Array.from(tablesOfSql(upsert).written)).toEqual(['License'])
        expect(Array.from(tablesOfSql('SELECT id FROM "User" WHERE id = $1 FOR UPDATE').written)).toEqual([])
        expect(Array.from(tablesOfSql('UPDATE "Payment" AS p SET x = 1 FROM "LedgerTransaction" AS t').read).sort())
            .toEqual(['LedgerTransaction', 'Payment'])
    })
})

describe('the watcher on the client', () => {
    test('a read is told the tables of every call awaited in it, and not those of a read beside it', async () => {
        const read = watchTablesRead(async () => {
            const [users] = await Promise.all([
                prisma.user.count(),
                prisma.committee.findMany({ take: 1 }),
            ])
            await flairOperations.readAll({ bypassAuth: true })
            return users
        })
        const beside = watchTablesRead(async () => await prisma.omegaQuote.count())
        await Promise.all([read.result, beside.result])

        expect(sorted(read.seen.tables)).toEqual(expect.arrayContaining(['Committee', 'Flair', 'Image', 'User']))
        expect(sorted(read.seen.tables)).not.toContain('OmegaQuote')
        expect(sorted(beside.seen.tables)).toEqual(['OmegaQuote'])
    })

    test('a read that throws has read its tables all the same', async () => {
        const read = watchTablesRead(async () => (
            await prisma.user.findUniqueOrThrow({ where: { id: -1 }, include: { image: true } })
        ))
        await expect(read.result).rejects.toThrow()
        expect(sorted(read.seen.tables)).toEqual(['Image', 'User'])
    })

    test('raw SQL makes the tables of a read unknown, also in a transaction', async () => {
        const raw = watchTablesRead(async () => await prisma.$transaction(async tx => {
            await tx.user.count()
            return await tx.$queryRaw`SELECT count(*) FROM "User"`
        }))
        await raw.result
        expect(raw.seen.tables).toBe('unknown')
    })

    test('a write is told when it is done, and one in a transaction when the transaction has ended', async () => {
        const told: (string[] | 'unknown')[] = []
        const stop = onTablesWritten(tables => told.push(sorted(tables)))
        const license = await prisma.license.create({ data: { name: 'Watched', link: 'https://watched.test' } })
        expect(told).toEqual([['License']])
        // An image refers to its license by name and link, so the database may write the images too.
        const moveTo = (link: string) => ({ where: { id: license.id }, data: { link } })

        await prisma.$transaction(async tx => {
            await tx.license.update(moveTo('https://watched.test/in-a-transaction'))
            await tx.$transaction(async nested => {
                await nested.flair.updateMany({ where: { id: -1 }, data: { name: 'none' } })
            })
            expect(told).toHaveLength(1)
        })
        expect(told.slice(1)).toEqual([['Flair', 'Image', 'License']])

        await prisma.$transaction([prisma.license.count(), prisma.license.update(moveTo('https://watched.test'))])
        expect(told.slice(2)).toEqual([['Image', 'License']])

        await expect(prisma.$transaction(async tx => {
            await tx.license.delete({ where: { id: license.id } })
            throw new Error('rolled back')
        })).rejects.toThrow('rolled back')
        expect(told.slice(3)).toEqual([['Image', 'License']])

        await prisma.$executeRaw`SELECT 1`
        expect(told.slice(4)).toEqual(['unknown'])
        stop()
    })

    test('a write is told after it is done, so a read begun when it is told reads what was written', async () => {
        const { id } = await prisma.license.create({ data: { name: 'Told', link: 'https://told.test' } })
        const linksReadWhenTold: Promise<string>[] = []
        const stop = onTablesWritten(() => {
            linksReadWhenTold.push((async () => (await prisma.license.findUniqueOrThrow({ where: { id } })).link)())
        })

        await prisma.license.update({ where: { id }, data: { link: 'https://told.test/written' } })
        stop()

        expect(await Promise.all(linksReadWhenTold)).toEqual(['https://told.test/written'])
    })

    test('a transaction opened on the client inside another is told when it ends, and with the outer one', async () => {
        const told: (string[] | 'unknown')[] = []
        const stop = onTablesWritten(tables => told.push(sorted(tables)))

        await prisma.$transaction(async tx => {
            await tx.flair.updateMany({ where: { id: -1 }, data: { name: 'none' } })
            await prisma.$transaction(async other => {
                await other.omegaQuote.updateMany({ where: { id: -1 }, data: { quote: 'none' } })
            })
            expect(told).toEqual([['OmegaQuote']])
        })

        expect(told).toEqual([['OmegaQuote'], ['Flair', 'OmegaQuote']])
        stop()
    })

    test('is one for the process, also in a copy of the module, as each runtime of a production build has', async () => {
        jest.resetModules()
        const copy = await import('@/prisma/tableWatch/watch')
        const { prisma: clientOfTheCopy } = await import('@/prisma-pn-client-instance')
        expect(copy.watchTablesRead).not.toBe(watchTablesRead)
        expect(clientOfTheCopy).toBe(prisma)

        const told: (string[] | 'unknown')[] = []
        const stop = copy.onTablesWritten(tables => told.push(sorted(tables)))
        const read = copy.watchTablesRead(async () => await prisma.omegaQuote.count())
        await read.result
        await prisma.omegaQuote.updateMany({ where: { id: -1 }, data: { quote: 'none' } })
        stop()

        expect(sorted(read.seen.tables)).toEqual(['OmegaQuote'])
        expect(told).toEqual([['OmegaQuote']])
    })
})
