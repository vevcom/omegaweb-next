import { tableMap } from '@/prisma-generated-table-map'
import { Prisma } from '@/prisma-generated-pn-client'
import { tablesOfQuery } from '@/prisma/tableWatch/tablesOfQuery'
import { afterAll, expect, jest } from '@jest/globals'
import type { TablesOfQuery } from '@/prisma/tableWatch/tablesOfQuery'
import type * as Watch from '@/prisma/tableWatch/watch'
import type * as AdapterPg from '@prisma/adapter-pg'

/**
 * The check of `tablesOfQuery`, which is what finds a table it misses. Every statement the driver
 * adapter is handed is held against the calls of the Prisma client under way: a table in the SQL
 * that none of them named is a miss, and fails the test file it was sent in. So the whole suite
 * checks the function against every shape of query the code sends, and a `$queryRaw` that writes
 * is a miss too.
 *
 * It does not see what sends no SQL: a cascade, a `SetNull` or a carried change of a key, which the
 * test of the table map against the database guards. A call beside the missed one that names the
 * table hides the miss, as does one whose tables are unknown.
 *
 * A statement cannot be held against the one call it belongs to, since Prisma sends the lookups of
 * calls made at the same time as one statement.
 */
type SqlQueryable = Pick<Awaited<ReturnType<AdapterPg.PrismaPg['connect']>>, 'queryRaw' | 'executeRaw'>

const tableNames = new Set(Object.values(tableMap).flatMap(model => [
    model.table,
    ...Object.values(model.relations).flatMap(relation => (relation.kind === 'manyToMany' ? [relation.joinTable] : [])),
]))

const writtenInSql = new RegExp([
    /\b(?:INSERT\s+INTO|(?<!DO\s)UPDATE(?!\s+SET\b|\s+OF\b|\s*$)|DELETE\s+FROM)\s+(?:ONLY\s+)?/,
    /(?:"?[A-Za-z_]+"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/,
].map(part => part.source).join(''), 'gi')

const callsUnderWay = new Set<TablesOfQuery>()
/** By what was missed, with the first statement it was missed in. */
const misses = new Map<string, string>()

jest.doMock('@prisma/adapter-pg', () => {
    const adapterPg = jest.requireActual<typeof AdapterPg>('@prisma/adapter-pg')
    class CheckedPrismaPg extends adapterPg.PrismaPg {
        public async connect() {
            const adapter = await super.connect()
            const startTransaction = adapter.startTransaction.bind(adapter)
            checkStatementsOf(adapter)
            adapter.startTransaction = async isolationLevel => {
                const transaction = await startTransaction(isolationLevel)
                checkStatementsOf(transaction)
                return transaction
            }
            return adapter
        }
    }
    return { ...adapterPg, PrismaPg: CheckedPrismaPg }
})

// By its path, since jest does not know the aliases of the imports.
jest.doMock('../src/prisma/tableWatch/watch', () => {
    const watch = jest.requireActual<typeof Watch>('../src/prisma/tableWatch/watch')
    // Before the watcher, which goes on last.
    const tableWatch = Prisma.defineExtension(client => client.$extends({
        name: 'tableWatchCheck',
        query: {
            $allOperations({ model, operation, args, query }) {
                const call = tablesOfQuery(model, operation, args)
                callsUnderWay.add(call)
                return query(args).finally(() => {
                    callsUnderWay.delete(call)
                })
            },
        },
    }).$extends(watch.tableWatch))
    return { ...watch, tableWatch }
})

afterAll(() => {
    expect(Array.from(misses, ([missed, sql]) => `${missed} in: ${sql}`)).toEqual([])
})

/**
 * The tables named in a statement. Every quoted name that is a table counts as read, so a column
 * named as a table does too, which only asks more of the function.
 */
export function tablesOfSql(sql: string) {
    const quoted = Array.from(sql.matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g), ([, name]) => name)
    return {
        read: new Set(quoted.filter(name => tableNames.has(name))),
        written: new Set(Array.from(sql.matchAll(writtenInSql), ([, name]) => name)),
    }
}

function checkStatementsOf(queryable: SqlQueryable) {
    const queryRaw = queryable.queryRaw.bind(queryable)
    const executeRaw = queryable.executeRaw.bind(queryable)
    queryable.queryRaw = query => {
        check(query.sql)
        return queryRaw(query)
    }
    queryable.executeRaw = query => {
        check(query.sql)
        return executeRaw(query)
    }
}

function check(sql: string) {
    const calls = Array.from(callsUnderWay)
    const inSql = tablesOfSql(sql)
    const isRead = (table: string) => calls.some(call => call.read === 'unknown' || call.read.has(table))
    const isWritten = (table: string) => calls.some(call => call.written === 'unknown' || call.written.has(table))
    const missed = [
        ...Array.from(inSql.read).filter(table => !isRead(table) && !isWritten(table)).map(table => `read ${table}`),
        ...Array.from(inSql.written).filter(table => !isWritten(table)).map(table => `written ${table}`),
    ]
    missed.filter(miss => !misses.has(miss)).forEach(miss => misses.set(miss, sql.slice(0, 300)))
}
