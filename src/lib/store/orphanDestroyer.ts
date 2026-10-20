import '@pn-server-only'
import logger from '@/lib/logger'
import type { implementStore } from './implementStore'
import type { Awaitable } from '@/lib/awaitable'

/**
 * How many file names are read from the directory and looked up in the database at a time: one
 * query per batch, and only one batch held in memory.
 */
const batchSize = 500

/**
 * How long a file must have been unreferenced on every run before it is destroyed. A day outlasts
 * any reset, restore or seeding of the database, during which files that are about to be referenced
 * look orphaned.
 */
const defaultConfirmAfterMs = 24 * 60 * 60 * 1000

type Store = Pick<ReturnType<typeof implementStore>, 'listFiles' | 'destroyFile'>

/**
 * Makes a function that destroys the orphans of a store: the files no database row points to.
 *
 * A file is stored before the row that points to it is committed, so anything that stops the
 * commit - a transaction rolled back after the upload, a process that died in between - leaves the
 * file behind with nothing referring to it. Rather than every writer cleaning up after each way it
 * can fail, the store worker runs this to find them all afterwards.
 *
 * One look at the database cannot tell an orphan from a file whose row is not there yet: an upload
 * still being committed, or a database in the middle of being reset, restored or seeded. So a file
 * is only destroyed once it has been unreferenced on every run for `confirmAfterMs`. A file that is
 * referenced on any run in between is forgotten. Which files are waiting is kept in memory, so a
 * restart only makes it wait longer, never destroy anything sooner.
 *
 * The directory is read in batches, and each batch is looked up in the database before anything
 * else is done with it, so the files that belong to a row cost one query per batch and nothing
 * more.
 */
export function createOrphanDestroyer(store: Store, {
    confirmAfterMs = defaultConfirmAfterMs,
    referenced,
    context,
}: {
    confirmAfterMs?: number,
    /** Which of the given file names the database refers to. */
    referenced: (fsLocations: string[]) => Awaitable<Set<string>>,
    context: string,
}) {
    /** The files found unreferenced on every run so far, with when they were first found so. */
    let unreferencedSince = new Map<string, number>()

    /**
     * @param now The time of the run. Only tests pass it.
     * @returns how many files were destroyed.
     */
    return async function destroyOrphans(now: number = Date.now()): Promise<number> {
        const stillUnreferenced = new Map<string, number>()
        let removed = 0
        let failed: unknown[] = []

        for await (const batch of store.listFiles(batchSize)) {
            const known = await referenced(batch)
            const orphans: string[] = []
            for (const fsLocation of batch.filter(name => !known.has(name))) {
                const since = unreferencedSince.get(fsLocation) ?? now
                if (now - since >= confirmAfterMs) orphans.push(fsLocation)
                else stillUnreferenced.set(fsLocation, since)
            }

            const results = await Promise.allSettled(
                orphans.map(fsLocation => store.destroyFile(fsLocation, undefined, false))
            )
            for (let index = 0; index < results.length; index++) {
                const result = results[index]
                if (result.status === 'fulfilled') {
                    removed++
                    continue
                }
                failed = [...failed, result.reason]
                // Tried again on the next run.
                stillUnreferenced.set(orphans[index], unreferencedSince.get(orphans[index]) ?? now)
            }
        }

        unreferencedSince = stillUnreferenced

        if (failed.length > 0) {
            logger.error(`Failed to destroy ${failed.length} orphaned file(s) in ${context}`, { errors: failed })
        }
        if (removed > 0) logger.info(`Destroyed ${removed} orphaned file(s) in ${context}`)
        return removed
    }
}
