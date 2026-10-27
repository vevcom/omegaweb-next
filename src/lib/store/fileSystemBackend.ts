import '@pn-server-only'
import { createReadStream } from 'fs'
import { mkdir, opendir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dirname, join } from 'path'
import { Readable } from 'stream'
import type { StoreBackend } from './types'

const root = 'store'

function isMissingFile(error: unknown) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

async function exists(key: string) {
    try {
        return (await stat(join(root, key))).isFile()
    } catch (error) {
        if (isMissingFile(error)) return false
        throw error
    }
}

/** The store as files under `store/` on local disk. */
export const fileSystemBackend: StoreBackend = {
    /**
     * Written to a temporary file and renamed into place, so a reader sees either the old file or
     * the new one, never half of the new one.
     */
    async write(key, content) {
        const path = join(root, key)
        await mkdir(dirname(path), { recursive: true })
        const temporary = `${path}.${randomUUID()}.tmp`
        await writeFile(temporary, content)
        await rename(temporary, path)
    },

    async read(key) {
        try {
            return await readFile(join(root, key))
        } catch (error) {
            if (isMissingFile(error)) return null
            throw error
        }
    },

    async stream(key) {
        if (!await exists(key)) return null
        return Readable.toWeb(createReadStream(join(root, key))) as ReadableStream
    },

    exists,

    async destroy(key) {
        try {
            await unlink(join(root, key))
            return true
        } catch (error) {
            if (isMissingFile(error)) return false
            throw error
        }
    },

    /** Read from the directory a batch at a time, so a store of any size is never held in memory at once. */
    async *list(prefix, batchSize) {
        let directory
        try {
            directory = await opendir(join(root, prefix), { bufferSize: batchSize })
        } catch (error) {
            if (isMissingFile(error)) return
            throw error
        }
        let batch: string[] = []
        for await (const entry of directory) {
            if (!entry.isFile()) continue
            batch.push(entry.name)
            if (batch.length >= batchSize) {
                yield batch
                batch = []
            }
        }
        if (batch.length > 0) yield batch
    },
}
