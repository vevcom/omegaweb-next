import { tablesOfQuery } from '@/prisma/tableWatch/tablesOfQuery'
import { Prisma } from '@/prisma-generated-pn-client'
import { AsyncLocalStorage } from 'async_hooks'
import type { Tables } from '@/prisma/tableWatch/tablesOfQuery'

type TableWatchState = {
    watchInForce: AsyncLocalStorage<TablesSeen>,
    /** The writes of a transaction under way, which no other query sees before it has ended. */
    transactionInForce: AsyncLocalStorage<{ written: TablesSeen, hasEnded: boolean }>,
    writeListeners: Set<WriteListener>,
}

/**
 * One for the process, hung on `globalThis`. A production build has a copy of this module in each
 * of its runtimes, one for the pages and one for the route handlers, and they share one client.
 */
const stateKey = Symbol.for('omegaweb.tableWatch')
const processWide: typeof globalThis & { [stateKey]?: TableWatchState } = globalThis
const { watchInForce, transactionInForce, writeListeners } = processWide[stateKey] ??= {
    watchInForce: new AsyncLocalStorage(),
    transactionInForce: new AsyncLocalStorage(),
    writeListeners: new Set(),
}

/**
 * The watcher of the Prisma client, for `$extends`: every call of the client passes it, and those
 * of the transactions it opens. The tables a call reads are added to the watch in force, see
 * {@link watchTablesRead}, and the tables it writes are told to whoever listens, see
 * {@link onTablesWritten}. It is put on last: a transaction is opened on the client the watcher was
 * put on, so an extension put on after it is not on the client of a transaction.
 *
 * A call is watched where it is awaited, since that is where Prisma sends it from.
 */
export const tableWatch = Prisma.defineExtension(client => {
    const watched = client.$extends({
        name: 'tableWatch',
        query: {
            $allOperations({ model, operation, args, query }) {
                const tables = tablesOfQuery(model, operation, args)
                watchInForce.getStore()?.add(tables.read)
                if (tables.written !== 'unknown' && !tables.written.size) return query(args)

                // One that has ended is still in force for what its callback set off and left running.
                const transaction = transactionInForce.getStore()
                if (!transaction || transaction.hasEnded) return query(args).finally(() => tellOfWrite(tables.written))
                transaction.written.add(tables.written)
                return query(args)
            },
        },
    })

    return watched.$extends({
        name: 'tableWatchOfTransactions',
        client: {
            $transaction(...args: Parameters<typeof watched.$transaction>) {
                const inForce = { written: new TablesSeen(), hasEnded: false }
                const transaction = transactionInForce.run(inForce, () => watched.$transaction(...args))
                return transaction.finally(() => {
                    inForce.hasEnded = true
                    // One opened while another is under way may be part of it, so that one tells of it too.
                    transactionInForce.getStore()?.written.add(inForce.written.tables)
                    return inForce.written.isEmpty ? undefined : tellOfWrite(inForce.written.tables)
                })
            },
        },
    })
})

/** Tables as they are met, one call after another. Once any of them is unknown, they all are. */
export class TablesSeen {
    private seen: Set<string> | 'unknown' = new Set()
    private outsideTheDatabase = false

    public add(tables: Tables) {
        if (this.seen === 'unknown') return
        if (tables === 'unknown') {
            this.seen = 'unknown'
            return
        }
        const { seen } = this
        tables.forEach(table => seen.add(table))
    }

    public get tables(): Tables {
        return this.seen
    }

    public get isEmpty() {
        return this.seen !== 'unknown' && !this.seen.size
    }

    public addReadOutsideTheDatabase() {
        this.outsideTheDatabase = true
    }

    /**
     * Whether what was read may be of another system, which no table shows: nothing of the database
     * was read, or a read that was asked for along the way read none.
     */
    public get readOutsideTheDatabase() {
        return this.isEmpty || this.outsideTheDatabase
    }
}

/**
 * Runs a read with a watch of its own in force and gives what the watch has seen: the tables read
 * by every call of the client that was awaited while the read ran, which is all of them once the
 * read has ended. So the read awaits what it reads, and hands back no call it has not awaited.
 */
export function watchTablesRead<Result>(read: () => Result): { result: Result, seen: TablesSeen } {
    const seen = new TablesSeen()
    return { result: watchInForce.run(seen, read), seen }
}

/** Adds what an answer read to the watch in force, when it was given without a call of the client. */
export function addSeenByAnAnswer(seen: TablesSeen) {
    const watch = watchInForce.getStore()
    watch?.add(seen.tables)
    if (seen.readOutsideTheDatabase) watch?.addReadOutsideTheDatabase()
}

/**
 * Calls the listener with the tables of every write, after the write is done and other queries see
 * it: a write in a transaction is told when the transaction has ended, also when it was rolled back.
 * The listener is called in the async context the write was awaited in, and the write is done for
 * its caller once what the listener returns has settled. Returns how to stop.
 */
export function onTablesWritten(listener: WriteListener): () => void {
    writeListeners.add(listener)
    return () => writeListeners.delete(listener)
}

type WriteListener = (tables: Tables) => unknown

function tellOfWrite(tables: Tables) {
    return Promise.all(Array.from(writeListeners, listener => listener(tables)))
}
