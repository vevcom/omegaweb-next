import '@pn-server-only'
import { extensionForContent, type StorableExtension } from './fileExtensions'
import { readStoreContent, writeStoreContent } from './locations'
import { storeDirectories } from './paths'
import { storeUpkeep, type StoreFileOwner } from './constants'
import { destroyOrphans, moveFilesToPreferredLocation, reportFilesOfOtherOwners } from './upkeep'
import { ServiceError } from '@/services/error'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import { v4 as uuid } from 'uuid'
import type { File } from 'buffer'
import type { StoreFileLocation, StoreFilePurpose } from '@/prisma-generated-pn-types'
import type { Worker } from '@/workers/types'

/**
 * Implements the store for one purpose, which gives the implementing service the files of that
 * purpose. A file is a StoreFile row and its content. The service keeps the file's name on the row
 * that owns it, as a relation to StoreFile, and shows it at `storeFilePath(purpose, name)`. Where
 * the content is, in the S3 bucket or on the store volume, is the store's to know.
 *
 * - `allowedExtensions` is what a file of the purpose may be, captured as a literal type so that
 *   createFile can be told a subset of it and never anything wider.
 * - `preferredLocation` is where the content should be. It is written to the other location when
 *   the preferred one fails or is not in use, and the worker moves it once it can.
 * - `owners` are the relations of StoreFile through which a row may refer to a file of the purpose.
 *   A file no row refers to is an orphan, which the worker destroys, so a service never destroys a
 *   file: it deletes or changes the row that refers to it.
 *
 * `worker` is mounted in workers/definitions.ts. Every run it reports the files of the purpose
 * that a relation outside `owners` refers to, destroys the orphans and moves the files that are
 * not in the preferred location.
 */
export function implementStore<const AllowedExt extends readonly StorableExtension[]>({
    purpose,
    allowedExtensions,
    preferredLocation,
    owners,
}: {
    purpose: StoreFilePurpose,
    allowedExtensions: AllowedExt,
    preferredLocation: StoreFileLocation,
    owners: readonly StoreFileOwner[],
}) {
    const storeKey = (name: string) => `${storeDirectories[purpose]}/${name}`

    /**
     * The type the file's content shows it to be, out of `allowedExt`. Throws the same error createFile
     * would, so a caller can check a file before doing anything else with it.
     */
    function storableExtension(
        content: Buffer,
        allowedExt: readonly AllowedExt[number][] = allowedExtensions,
    ): AllowedExt[number] {
        const ext = extensionForContent(content, allowedExt)
        if (ext === null) {
            throw new ServiceError('BAD PARAMETERS', [
                {
                    path: ['file'],
                    message: `Filtypen må være en av ${allowedExt.join(', ')}`
                }
            ])
        }
        return ext
    }

    /**
     * Stores a file, whose type is decided by its content and never by the mime type a client sent.
     *
     * The row is written on its own and not in a transaction of the caller, so the file is known
     * even when the caller's write is rolled back. It is then an orphan, which the worker destroys.
     * @returns the name to keep on the owning row.
     */
    async function createFile(
        file: File | Buffer,
        allowedExt: readonly AllowedExt[number][] = allowedExtensions,
    ): Promise<{ name: string, ext: AllowedExt[number] }> {
        const content = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer())
        const ext = storableExtension(content, allowedExt)
        const name = `${uuid()}.${ext}`
        const location = await writeStoreContent(storeKey(name), content, preferredLocation)
        await prisma.storeFile.create({ data: { name, purpose, location } })
        return { name, ext }
    }

    async function readFile(name: string): Promise<Buffer> {
        const file = await prisma.storeFile.findUnique({ where: { name }, select: { purpose: true, location: true } })
        const content = file?.purpose === purpose ? await readStoreContent(storeKey(name), file.location) : null
        if (content === null) {
            throw new ServiceError('NOT FOUND', 'Filen du forsøkte å finne ble ikke funnet')
        }
        return content
    }

    const name = `Store worker of ${purpose}`
    const upkeep = { purpose, preferredLocation, owners }

    /** One step failing does not keep the others from running. */
    const worker: Worker = {
        name,
        intervalMs: storeUpkeep.intervalMs,
        tick: async progress => {
            for (const step of [reportFilesOfOtherOwners, destroyOrphans, moveFilesToPreferredLocation]) {
                try {
                    await step(upkeep, progress)
                } catch (error) {
                    logger.error(`${name} failed: ${error}`)
                }
            }
        },
    }

    return {
        createFile,
        readFile,
        storableExtension,
        worker,
    } as const
}
