import '@pn-server-only'
import { destroyStoreContent, locationsFrom, storeBackends } from './locations'
import { storeDirectories } from './paths'
import { storeFileOwners, storeUpkeep, type StoreFileOwner } from './constants'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { Prisma, StoreFileLocation, StoreFilePurpose } from '@/prisma-generated-pn-types'

/** What the worker of a purpose goes by, from its implementStore. */
export type StoreUpkeep = {
    purpose: StoreFilePurpose,
    preferredLocation: StoreFileLocation,
    owners: readonly StoreFileOwner[],
}

type FileOfPurpose = { id: number, name: string, location: StoreFileLocation }

/** No row refers to the file through any of the relations. */
function referredToByNone(owners: readonly StoreFileOwner[]): Prisma.StoreFileWhereInput[] {
    return owners.map(owner => ({ [owner]: { is: null } }))
}

/** The files of a purpose that match, a batch at a time and in the order they were made. */
async function* filesOfPurpose(
    purpose: StoreFilePurpose,
    where: Prisma.StoreFileWhereInput,
): AsyncGenerator<FileOfPurpose[]> {
    let lastId = 0
    for (;;) {
        const files = await prisma.storeFile.findMany({
            where: { AND: [{ purpose, id: { gt: lastId } }, where] },
            orderBy: { id: 'asc' },
            take: storeUpkeep.batchSize,
            select: { id: true, name: true, location: true },
        })
        if (files.length === 0) return
        lastId = files[files.length - 1].id
        yield files
    }
}

/**
 * Says which files of the purpose a relation outside its owners refers to, such as an image whose
 * original is an ombul's pdf. Nothing but a bug makes one, and nothing can be done about it here
 * short of deleting the row that refers to the file, so it is reported on every run until someone
 * has dealt with it.
 */
export async function reportFilesOfOtherOwners({ purpose, owners }: StoreUpkeep): Promise<void> {
    const others = storeFileOwners.filter(owner => !owners.includes(owner))
    if (others.length === 0) return
    const files = await prisma.storeFile.findMany({
        where: { purpose, OR: others.map(owner => ({ [owner]: { isNot: null } })) },
        select: { name: true, ...Object.fromEntries(others.map(owner => [owner, { select: { id: true } }])) },
    })
    if (files.length === 0) return
    logger.error(`${files.length} store file(s) of ${purpose} are referred to through another relation than ${
        owners.join(', ')
    }`, { files })
}

/**
 * Destroys the orphans of the purpose: the files no row refers to. This is the one way a file
 * leaves the store, so whatever stops referring to a file, a deleted row, a replaced file or a
 * write that was rolled back after the upload, has nothing to clean up.
 *
 * The row goes first and only while it is still an orphan, which the foreign keys of its owners
 * also see to, so a file something refers to is never destroyed. Content that could not be
 * destroyed has no row any more, and is left to the worker of the untracked files.
 * @param now The time of the run. Only tests pass it.
 * @returns how many files were destroyed.
 */
export async function destroyOrphans(
    { purpose }: StoreUpkeep,
    progress?: () => void,
    now = Date.now(),
): Promise<number> {
    const orphaned = {
        createdAt: { lt: new Date(now - storeUpkeep.orphanGraceMs) },
        AND: referredToByNone(storeFileOwners),
    } satisfies Prisma.StoreFileWhereInput
    let destroyed = 0
    const failures: unknown[] = []

    for await (const files of filesOfPurpose(purpose, orphaned)) {
        for (const file of files) {
            const { count } = await prisma.storeFile.deleteMany({ where: { id: file.id, ...orphaned } })
            if (count === 0) continue
            destroyed++
            await destroyStoreContent(`${storeDirectories[purpose]}/${file.name}`).catch((error: unknown) => {
                failures.push(error)
            })
            progress?.()
        }
    }

    if (failures.length > 0) {
        logger.error(`Failed to destroy the content of ${failures.length} orphaned file(s) of ${purpose}`, {
            errors: failures,
        })
    }
    if (destroyed > 0) logger.info(`Destroyed ${destroyed} orphaned file(s) of ${purpose}`)
    return destroyed
}

/** The files of each purpose already reported as missing, so each is only reported once per process. */
const reportedMissing = new Set<number>()

/**
 * Moves the files of the purpose that are not where the purpose wants them: those written to the
 * other location when the preferred one failed, and all of them when the purpose's preference
 * changes. Without the preferred location in use, the one that is counts as preferred.
 *
 * A file is written to its new location, then its row is changed, then the old content is
 * destroyed, so the row is right about a file that is being read all the way through. A row that
 * is wrong about where its content is, which the content being in the new location already shows,
 * is corrected. The run ends at the first write the new location refuses, since it will refuse
 * the rest too, and the next run tries again.
 * @returns how many files were moved or corrected.
 */
export async function moveFilesToPreferredLocation(
    { purpose, preferredLocation }: StoreUpkeep,
    progress?: () => void,
): Promise<number> {
    const [target] = locationsFrom(preferredLocation)
    let moved = 0
    let corrected = 0
    const report = () => {
        if (moved > 0) logger.info(`Moved ${moved} file(s) of ${purpose} to ${target.location}`)
        if (corrected > 0) logger.info(`Found ${corrected} file(s) of ${purpose} in ${target.location} already`)
        return moved + corrected
    }

    for await (const files of filesOfPurpose(purpose, { location: { not: target.location } })) {
        for (const file of files) {
            const key = `${storeDirectories[purpose]}/${file.name}`
            const source = storeBackends[file.location]
            const content = source ? await source.read(key) : null
            if (content === null) {
                if (await target.backend.exists(key)) {
                    await prisma.storeFile.updateMany({ where: { id: file.id }, data: { location: target.location } })
                    corrected++
                } else if (!reportedMissing.has(file.id)) {
                    reportedMissing.add(file.id)
                    logger.error(`Store file ${key} is in no location`)
                }
                continue
            }

            try {
                await target.backend.write(key, content)
            } catch (error) {
                logger.warn(`Stopped moving the files of ${purpose} to ${target.location}, which refused ${key}: ${error}`)
                return report()
            }
            await prisma.storeFile.updateMany({ where: { id: file.id }, data: { location: target.location } })
            await source?.destroy(key).catch((error: unknown) => {
                logger.error(`Failed to destroy ${key} in ${file.location} after moving it: ${error}`)
            })
            moved++
            progress?.()
        }
    }

    return report()
}
