import '@pn-server-only'
import { streamStoreContent } from './locations'
import { storeDirectories } from './paths'
import { prisma } from '@/prisma-pn-client-instance'

/**
 * The content of the store file served at `/store/<directory>/<name>`, or null when there is no
 * such file. Only what a StoreFile row names is served, from wherever the row says it is.
 */
export async function streamStoreFile(directory: string, name: string): Promise<ReadableStream | null> {
    const file = await prisma.storeFile.findUnique({ where: { name }, select: { purpose: true, location: true } })
    if (!file || storeDirectories[file.purpose] !== directory) return null
    return streamStoreContent(`${directory}/${name}`, file.location)
}
