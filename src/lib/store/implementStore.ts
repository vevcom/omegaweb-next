import '@pn-server-only'
import { extensionForContent, type StorableExtension } from './fileExtensions'
import { ServiceError } from '@/services/error'
import { v4 as uuid } from 'uuid'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type { File } from 'buffer'

/**
 * This implements the store and lets a service use the store. The staticStorePrefix is where the service will store
 * its files in the store volume. The allowedExtentions is used to validate the file type before storing it, and is
 * captured as a literal type so createFile's own allowedExt can be typechecked as a subset of it - createFile can be
 * stricter than the implementation about which extensions it allows, but never wider.
 *
 * The implementation exposes two functions, createFile and destroyFile, that the service can use to create and
 * destroy files in the store.
 *
 * createFile takes a File, checks its type by its content (never by the mime type the client sent), and stores it
 * in the store volume.
 * It returns the fsLocation and ext of the stored file.
 * destroyFile takes the fsLocation of a file and deletes it from the store volume.
 */
export function implementStore<const AllowedExt extends readonly StorableExtension[]>(config: {
    staticStorePrefix: string,
    allowedExtentions: AllowedExt
}) {
    async function createFile(
        file: File,
        allowedExt: readonly AllowedExt[number][] = config.allowedExtentions,
        prosessor: (buffer: Buffer) => Promise<Buffer> = (buffer) => Promise.resolve(buffer),
        dynamicStorePrefix?: string,
    ): Promise<{
        fsLocation: string,
        ext: AllowedExt[number]
    }> {
        const buffer = Buffer.from(await file.arrayBuffer())
        const ext = storableExtension(buffer, allowedExt)
        const processedBuffer = await prosessor(buffer)
        const fsLocation = `${uuid()}.${ext}`
        const destination = dynamicStorePrefix
            ? join('store', config.staticStorePrefix, dynamicStorePrefix)
            : join('store', config.staticStorePrefix)
        await mkdir(destination, { recursive: true })
        await writeFile(join(destination, fsLocation), processedBuffer)
        return {
            fsLocation,
            ext
        }
    }

    async function readStoredFile(
        fsLocation: string,
        dynamicStorePrefix?: string
    ): Promise<Buffer> {
        const filePath = dynamicStorePrefix
            ? join('store', config.staticStorePrefix, dynamicStorePrefix, fsLocation)
            : join('store', config.staticStorePrefix, fsLocation)
        try {
            return await readFile(filePath)
        } catch (error) {
            if (isErrorWithCode(error) && error.code === 'ENOENT') {
                throw new ServiceError('NOT FOUND', 'Filen du forsøkte å finne ble ikke funnet')
            }
            throw error
        }
    }

    async function destroyFile(
        fsLocation: string,
        dynamicStorePrefix?: string,
        throwOnNotFound = true
    ): Promise<void> {
        const filePath = dynamicStorePrefix
            ? join('store', config.staticStorePrefix, dynamicStorePrefix, fsLocation)
            : join('store', config.staticStorePrefix, fsLocation)
        try {
            await unlink(filePath)
        } catch (error) {
            if (isErrorWithCode(error) && error.code === 'ENOENT') {
                if (throwOnNotFound) {
                    throw new ServiceError('NOT FOUND', 'Filen du forsøkte å finne ble ikke funnet')
                }
                return
            }
            throw error
        }
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
    } as const
}

function isErrorWithCode(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error
}
