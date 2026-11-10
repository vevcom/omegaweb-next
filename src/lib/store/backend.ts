import '@pn-server-only'
import { storeS3Config } from './constants'
import { fileSystemBackend } from './fileSystemBackend'
import { createS3Backend } from './s3Backend'
import type { StoreBackend } from './types'
import type { Awaitable } from '@/lib/awaitable'

/**
 * The bucket with a disk in front of it. A file is read from the disk first and written to the
 * bucket, so only what is put on the disk on purpose is there.
 * ponytail: exists so derived files can stay out of a bucket capped at 20k objects. Once the cap is
 * raised, copy the disk back with `rclone copy store s3:<bucket>` and use the bucket alone again.
 */
export function createLayeredBackend(disk: StoreBackend, bucket: StoreBackend): StoreBackend {
    return {
        write: (key, content) => bucket.write(key, content),
        read: async key => await disk.read(key) ?? await bucket.read(key),
        stream: async key => await disk.stream(key) ?? await bucket.stream(key),
        exists: async key => await disk.exists(key) || await bucket.exists(key),
        // A file being moved is in both for a moment. The bucket's copy is then left for the orphan destroyer.
        destroy: async key => await disk.destroy(key) || await bucket.destroy(key),
        async *list(prefix, batchSize) {
            yield* disk.list(prefix, batchSize)
            yield* bucket.list(prefix, batchSize)
        },
    }
}

const bucketBackend = storeS3Config ? createS3Backend(storeS3Config) : null

export const storeBackend: StoreBackend = bucketBackend
    ? createLayeredBackend(fileSystemBackend, bucketBackend)
    : fileSystemBackend

/** Where files that can be made again from others are kept: always the disk, to save the bucket's objects. */
export const derivedStoreBackend: StoreBackend = fileSystemBackend

/**
 * Moves the files directly under the prefix that `select` picks from the bucket to the disk.
 * Does nothing without a bucket. Only tests pass the backends.
 * @returns how many files were moved.
 */
export async function moveBucketFilesToDisk(
    prefix: string,
    select: (names: string[]) => Awaitable<string[]>,
    onProgress?: () => void,
    disk: StoreBackend = fileSystemBackend,
    bucket: StoreBackend | null = bucketBackend,
): Promise<number> {
    if (!bucket) return 0
    let moved = 0
    for await (const names of bucket.list(prefix, 500)) {
        for (const name of await select(names)) {
            const key = `${prefix}/${name}`
            const content = await bucket.read(key)
            if (content === null) continue
            await disk.write(key, content)
            await bucket.destroy(key)
            moved++
            onProgress?.()
        }
        onProgress?.()
    }
    return moved
}
