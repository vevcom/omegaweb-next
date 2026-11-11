import '@pn-server-only'
import { storeBackends } from './locations'
import { storeDirectories } from './paths'
import { untrackedFiles } from './constants'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { Awaitable } from '@/lib/awaitable'
import type { StoreFileLocation } from '@/prisma-generated-pn-types'
import type { Worker } from '@/workers/types'

type ListedFiles = {
    /** The names of the files, a batch at a time. */
    list: (batchSize: number) => AsyncGenerator<string[]>,
    /** false when there was no such file. */
    destroy: (name: string) => Promise<boolean>,
}

/**
 * Makes a function that destroys the untracked files of one directory in one location: the content
 * no StoreFile row names. The workers of the purposes go by the rows, so they never see it.
 *
 * Content is untracked when its row was never written, since the process died between storing the
 * content and writing the row, when its row is gone and the content could not be destroyed, and
 * when the database was restored to a time before the file.
 *
 * One look at the database cannot tell such a file from one whose row is not there yet: an upload
 * that is about to write it, or a database in the middle of being reset, restored or seeded. So a
 * file is only destroyed once it has been without a row on every run for `confirmAfterMs`. A file
 * that has a row on any run in between is forgotten. Which files are waiting is kept in memory, so
 * a restart only makes it wait longer, never destroy anything sooner.
 */
export function createUntrackedFileDestroyer(files: ListedFiles, {
    confirmAfterMs = untrackedFiles.confirmAfterMs,
    tracked,
    context,
}: {
    confirmAfterMs?: number,
    /** Which of the given file names a StoreFile row has. */
    tracked: (names: string[]) => Awaitable<Set<string>>,
    context: string,
}) {
    /** The files found untracked on every run so far, with when they were first found so. */
    let untrackedSince = new Map<string, number>()

    /**
     * @param now The time of the run. Only tests pass it.
     * @param onBatch Called after each batch, since a large store takes a while to go through.
     * @returns how many files were destroyed.
     */
    return async function destroyUntrackedFiles({ now = Date.now(), onBatch }: {
        now?: number,
        onBatch?: () => void,
    } = {}): Promise<number> {
        const stillUntracked = new Map<string, number>()
        let removed = 0
        let failed: unknown[] = []

        for await (const batch of files.list(untrackedFiles.batchSize)) {
            const known = await tracked(batch)
            const confirmed: string[] = []
            for (const name of batch.filter(listed => !known.has(listed))) {
                const since = untrackedSince.get(name) ?? now
                if (now - since >= confirmAfterMs) confirmed.push(name)
                else stillUntracked.set(name, since)
            }

            const results = await Promise.allSettled(confirmed.map(name => files.destroy(name)))
            for (let index = 0; index < results.length; index++) {
                const result = results[index]
                if (result.status === 'fulfilled') {
                    removed++
                    continue
                }
                failed = [...failed, result.reason]
                // Tried again on the next run.
                stillUntracked.set(confirmed[index], untrackedSince.get(confirmed[index]) ?? now)
            }
            onBatch?.()
        }

        untrackedSince = stillUntracked

        if (failed.length > 0) {
            logger.error(`Failed to destroy ${failed.length} untracked file(s) in ${context}`, { errors: failed })
        }
        if (removed > 0) logger.info(`Destroyed ${removed} untracked file(s) in ${context}`)
        return removed
    }
}

async function trackedFiles(names: string[]): Promise<Set<string>> {
    const files = await prisma.storeFile.findMany({ where: { name: { in: names } }, select: { name: true } })
    return new Set(files.map(file => file.name))
}

/** The backend is looked up on every call, since a location is only in use when it has one. */
function filesIn(location: StoreFileLocation, directory: string): ListedFiles {
    return {
        async *list(batchSize) {
            const backend = storeBackends[location]
            if (backend) yield* backend.list(directory, batchSize)
        },
        destroy: async name => await storeBackends[location]?.destroy(`${directory}/${name}`) ?? false,
    }
}

const locations: StoreFileLocation[] = ['S3', 'VOLUME']
const directories = Array.from(new Set<string>(Object.values(storeDirectories)))

const destroyers = locations.flatMap(location => directories.map(directory => ({
    context: `${directory} in ${location}`,
    destroyUntrackedFiles: createUntrackedFileDestroyer(filesIn(location, directory), {
        tracked: trackedFiles,
        context: `${directory} in ${location}`,
    }),
})))

/**
 * Destroys the untracked files of every directory of the store, in both locations. Mounted in
 * workers/definitions.ts next to the workers of the purposes. One directory failing does not keep
 * the others from being gone through.
 */
export const untrackedStoreFilesWorker: Worker = {
    name: 'Untracked store file worker',
    intervalMs: untrackedFiles.intervalMs,
    tick: async progress => {
        for (const { context, destroyUntrackedFiles } of destroyers) {
            try {
                await destroyUntrackedFiles({ onBatch: progress })
            } catch (error) {
                logger.error(`Untracked store file worker failed to go through ${context}: ${error}`)
            }
        }
    },
}
