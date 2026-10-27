import '@pn-server-only'
import { extensionForContent, type StorableExtension } from './fileExtensions'
import { storeBackend } from './backend'
import { ServiceError } from '@/services/error'
import { v4 as uuid } from 'uuid'
import { posix } from 'path'
import type { File } from 'buffer'
import type { Awaitable } from '@/lib/awaitable'

/**
 * This implements the store and lets a service use the store. The staticStorePrefix is where the service will store
 * its files in the store. The allowedExtentions is used to validate the file type before storing it, and is
 * captured as a literal type so createFile's own allowedExt can be typechecked as a subset of it - createFile can be
 * stricter than the implementation about which extensions it allows, but never wider.
 *
 * The implementation exposes two functions, createFile and destroyFile, that the service can use to create and
 * destroy files in the store.
 *
 * createFile takes a File, checks its type by its content (never by the mime type the client sent), and stores it
 * in the store.
 * It returns the fsLocation and ext of the stored file.
 * destroyFile takes the fsLocation of a file and deletes it from the store.
 * listFiles lets the store worker find the files no row refers to (see createOrphanDestroyer).
 *
 * The store is a directory on disk or an S3 bucket, see storeBackend.
 */
export function implementStore<const AllowedExt extends readonly StorableExtension[]>(config: {
    staticStorePrefix: string,
    allowedExtentions: AllowedExt
}) {
    function storeKey(fsLocation: string, dynamicStorePrefix?: string) {
        return dynamicStorePrefix
            ? posix.join(config.staticStorePrefix, dynamicStorePrefix, fsLocation)
            : posix.join(config.staticStorePrefix, fsLocation)
    }

    async function createFile(
        file: File,
        allowedExt: readonly AllowedExt[number][] = config.allowedExtentions,
        prosessor: (buffer: Buffer) => Awaitable<Buffer> = buffer => buffer,
        dynamicStorePrefix?: string,
    ): Promise<{
        fsLocation: string,
        ext: AllowedExt[number]
    }> {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = storableExtension(buffer, allowedExt)
        const processedBuffer = await prosessor(buffer)
        const fsLocation = `${uuid()}.${ext}`
        await storeBackend.write(storeKey(fsLocation, dynamicStorePrefix), processedBuffer)
        return {
            fsLocation,
            ext
        }
    }

    async function readStoredFile(
        fsLocation: string,
        dynamicStorePrefix?: string
    ): Promise<Buffer> {
        const content = await storeBackend.read(storeKey(fsLocation, dynamicStorePrefix))
        if (content === null) {
            throw new ServiceError('NOT FOUND', 'Filen du forsøkte å finne ble ikke funnet')
        }
        return content
    }

    async function destroyFile(
        fsLocation: string,
        dynamicStorePrefix?: string,
        throwOnNotFound = true
    ): Promise<void> {
        const destroyed = await storeBackend.destroy(storeKey(fsLocation, dynamicStorePrefix))
        if (!destroyed && throwOnNotFound) {
            throw new ServiceError('NOT FOUND', 'Filen du forsøkte å finne ble ikke funnet')
        }
    }

    /**
     * The fsLocations of the files in the store, a batch at a time so that a store of any size never
     * has to be held in memory at once. Only the store's own prefix is listed: no store keeps files
     * under a dynamic prefix.
     */
    function listFiles(batchSize: number): AsyncGenerator<string[]> {
        return storeBackend.list(config.staticStorePrefix, batchSize)
    }

    /**
     * The type the file's content shows it to be, out of `allowedExt`. Throws the same error createFile
     * would, so a caller can check a file before doing anything else with it.
     */
    function storableExtension(
        content: Buffer,
        allowedExt: readonly AllowedExt[number][] = config.allowedExtentions,
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

    return {
        createFile,
        storableExtension,
        readStoredFile,
        destroyFile,
        listFiles,
    } as const
}
