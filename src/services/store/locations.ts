import '@pn-server-only'
import { storeS3Config } from './constants'
import { fileSystemBackend } from './backends/fileSystem'
import { createS3Backend } from './backends/s3'
import logger from '@/lib/logger'
import type { StoreBackend } from './backends/types'
import type { StoreFileLocation } from '@/prisma-generated-pn-types'

/** The store itself failed, which says nothing about the file that was being read or written. */
export class StoreUnavailableError extends Error {
    constructor(cause: unknown) {
        super(`The store failed: ${cause}`, { cause })
    }
}

/**
 * The two places a file can be. A key is a path under the store, such as `images/<uuid>.avif`, and
 * is the same in both, so a file is moved from one to the other as it is. The bucket is null when
 * none is set, and everything is then on the volume.
 */
export const storeBackends: Record<StoreFileLocation, StoreBackend | null> = {
    S3: storeS3Config ? createS3Backend(storeS3Config) : null,
    VOLUME: fileSystemBackend,
}

/** The locations in use, with `first` at the front when it is one of them. */
export function locationsFrom(first: StoreFileLocation): { location: StoreFileLocation, backend: StoreBackend }[] {
    const order: StoreFileLocation[] = first === 'S3' ? ['S3', 'VOLUME'] : ['VOLUME', 'S3']
    return order.flatMap(location => {
        const backend = storeBackends[location]
        return backend ? [{ location, backend }] : []
    })
}

/**
 * Writes the content where it is wanted, or in the other location when that one fails or is not
 * in use.
 * @returns where the content ended up.
 */
export async function writeStoreContent(
    key: string,
    content: Buffer,
    preferred: StoreFileLocation,
): Promise<StoreFileLocation> {
    let failure: unknown = new Error('No store location is in use')
    for (const { location, backend } of locationsFrom(preferred)) {
        try {
            await backend.write(key, content)
            return location
        } catch (error) {
            logger.warn(`The store failed to write ${key} to ${location}: ${error}`)
            failure = error
        }
    }
    throw new StoreUnavailableError(failure)
}

/**
 * Looks for the content where it is said to be, then in the other location, since a file being
 * moved is for a moment only where its row does not say yet. A location failing only matters when
 * the content is in neither.
 */
async function findStoreContent<Content>(
    recorded: StoreFileLocation,
    find: (backend: StoreBackend) => Promise<Content | null>,
): Promise<Content | null> {
    const failures: unknown[] = []
    for (const { backend } of locationsFrom(recorded)) {
        try {
            const content = await find(backend)
            if (content !== null) return content
        } catch (error) {
            failures.push(error)
        }
    }
    if (failures.length > 0) throw new StoreUnavailableError(failures[0])
    return null
}

/** null when the content is in neither location. */
export function readStoreContent(key: string, recorded: StoreFileLocation): Promise<Buffer | null> {
    return findStoreContent(recorded, backend => backend.read(key))
}

/** null when the content is in neither location. */
export function streamStoreContent(key: string, recorded: StoreFileLocation): Promise<ReadableStream | null> {
    return findStoreContent(recorded, backend => backend.stream(key))
}

/**
 * Destroys the content in every location, since a move that failed half way leaves a copy in both.
 * Missing content is the state wanted, and no error.
 */
export async function destroyStoreContent(key: string): Promise<void> {
    const results = await Promise.allSettled(locationsFrom('S3').map(({ backend }) => backend.destroy(key)))
    const failed = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (failed) throw new StoreUnavailableError(failed.reason)
}
