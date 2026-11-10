import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { ombulStore } from '@/services/ombul/store'
import { storeBackends, StoreUnavailableError } from '@/services/store/locations'
import { fileSystemBackend } from '@/services/store/backends/fileSystem'
import { storeUpkeep } from '@/services/store/constants'
import { storeFilePath } from '@/services/store/paths'
import { streamStoreFile } from '@/services/store/serve'
import { findLostFilesOnVolume } from '@/services/store/upkeep'
import { createUntrackedFileDestroyer } from '@/services/store/untrackedFiles'
import { visibilityOperations } from '@/services/visibility/operations'
import logger from '@/lib/logger'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type { StoreBackend } from '@/services/store/backends/types'

// The tests go by the ombul purpose, which nothing seeds: a worker goes through every file of its
// purpose, and the volume is shared with the test files running alongside this one.

const pdf = Buffer.from('%PDF-1.4\n%%EOF\n')

/** A bucket in memory, in place of the one the tests have no S3 for. */
function memoryBackend(): StoreBackend & { files: Map<string, Buffer> } {
    const files = new Map<string, Buffer>()
    return {
        files,
        write: (key, content) => Promise.resolve(void files.set(key, content)),
        read: key => Promise.resolve(files.get(key) ?? null),
        stream: key => Promise.resolve(files.has(key) ? new Blob([new Uint8Array(files.get(key) ?? [])]).stream() : null),
        exists: key => Promise.resolve(files.has(key)),
        destroy: key => Promise.resolve(files.delete(key)),
        // eslint-disable-next-line @typescript-eslint/require-await
        async *list(prefix) {
            yield Array.from(files.keys())
                .filter(key => key.startsWith(`${prefix}/`))
                .map(key => key.slice(prefix.length + 1))
        },
    }
}

let bucket: ReturnType<typeof memoryBackend>

beforeEach(() => {
    bucket = memoryBackend()
    storeBackends.S3 = bucket
})

afterEach(() => {
    storeBackends.S3 = null
    jest.restoreAllMocks()
})

const key = (name: string) => `ombul/${name}`
const location = async (name: string) => (await prisma.storeFile.findUnique({ where: { name } }))?.location ?? null
const runWorker = () => ombulStore.worker.tick(() => undefined)

/** A file is only taken for an orphan once it is older than the grace period. */
async function makeOld(...names: string[]) {
    await prisma.storeFile.updateMany({
        where: { name: { in: names } },
        data: { createdAt: new Date(Date.now() - 2 * storeUpkeep.orphanGraceMs) },
    })
}

/**
 * An ombul that refers to the file, with the paragraph and the cover image an ombul needs. The
 * cover's original is a file of its own unless one is given.
 */
async function createOmbulOf(fsLocation: string, coverFsLocation?: string) {
    const [visibilityAdmin, visibilityRegular] = await Promise.all([
        visibilityOperations.create.internalCall({ prisma }),
        visibilityOperations.create.internalCall({ prisma }),
    ])
    const unique = `${Date.now()}-${Math.random()}`
    // The row alone, since nothing here reads the cover and the image store brings sharp along.
    const cover = coverFsLocation ?? (await prisma.storeFile.create({
        data: { name: `${unique}.svg`, purpose: 'ORIGINAL_IMAGE', location: 'VOLUME' },
    })).name
    return prisma.ombul.create({
        data: {
            name: `Ombul ${unique}`,
            year: 1900 + Math.floor(Math.random() * 100000),
            issueNumber: 1,
            file: { connect: { name: fsLocation } },
            paragraph: { create: {} },
            coverImage: {
                create: {
                    type: 'SVG',
                    alt: 'Forside',
                    extOriginal: 'svg',
                    originalFile: { connect: { name: cover } },
                    collection: {
                        create: {
                            name: `Store test collection ${unique}`,
                            visibilityAdminId: visibilityAdmin.id,
                            visibilityRegularId: visibilityRegular.id,
                        },
                    },
                },
            },
        },
    })
}

describe('createFile', () => {
    test('writes the file where its purpose wants it and remembers where that was', async () => {
        const { name, ext } = await ombulStore.createFile(pdf)

        expect(ext).toBe('pdf')
        expect(await location(name)).toBe('S3')
        expect(bucket.files.get(key(name))).toEqual(pdf)
        expect(await fileSystemBackend.exists(key(name))).toBe(false)
        expect(await ombulStore.readFile(name)).toEqual(pdf)
        expect(storeFilePath('OMBUL', name)).toBe(`/store/ombul/${name}`)
    })

    test('writes the file to the other location when the wanted one fails', async () => {
        jest.spyOn(bucket, 'write').mockRejectedValue(new Error('The bucket is full'))

        const { name } = await ombulStore.createFile(pdf)

        expect(await location(name)).toBe('VOLUME')
        expect(await fileSystemBackend.read(key(name))).toEqual(pdf)
        expect(await ombulStore.readFile(name)).toEqual(pdf)
    })

    test('writes the file to the volume when no bucket is in use', async () => {
        storeBackends.S3 = null

        const { name } = await ombulStore.createFile(pdf)

        expect(await location(name)).toBe('VOLUME')
    })

    test('fails as the store being unavailable when no location takes the file, and keeps no row', async () => {
        jest.spyOn(bucket, 'write').mockRejectedValue(new Error('The bucket is full'))
        jest.spyOn(fileSystemBackend, 'write').mockRejectedValueOnce(new Error('The disk is full'))
        const before = await prisma.storeFile.count()

        await expect(ombulStore.createFile(pdf)).rejects.toBeInstanceOf(StoreUnavailableError)

        expect(await prisma.storeFile.count()).toBe(before)
    })

    test('refuses a file that is not what its content should show', async () => {
        await expect(ombulStore.createFile(Buffer.from('not a pdf'))).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })
    })
})

describe('readFile', () => {
    test('finds a file in the other location than its row says', async () => {
        const { name } = await ombulStore.createFile(pdf)
        await prisma.storeFile.update({ where: { name }, data: { location: 'VOLUME' } })

        expect(await ombulStore.readFile(name)).toEqual(pdf)
    })

    test('is not found for a file without a row, and for one in no location', async () => {
        await expect(ombulStore.readFile('unknown.pdf')).rejects.toMatchObject({ errorCode: 'NOT FOUND' })

        const { name } = await ombulStore.createFile(pdf)
        bucket.files.clear()
        await expect(ombulStore.readFile(name)).rejects.toMatchObject({ errorCode: 'NOT FOUND' })
    })
})

describe('the worker of a purpose', () => {
    test('destroys a file no row refers to, once it is older than the grace period', async () => {
        const young = await ombulStore.createFile(pdf)
        const old = await ombulStore.createFile(pdf)
        await makeOld(old.name)

        await runWorker()

        expect(await location(old.name)).toBeNull()
        expect(bucket.files.has(key(old.name))).toBe(false)
        expect(await location(young.name)).toBe('S3')
        expect(bucket.files.has(key(young.name))).toBe(true)
    })

    test('keeps a file a row refers to, and destroys it once the row is gone', async () => {
        const { name } = await ombulStore.createFile(pdf)
        const ombul = await createOmbulOf(name)
        await makeOld(name)

        await runWorker()
        expect(bucket.files.has(key(name))).toBe(true)

        await prisma.ombul.delete({ where: { id: ombul.id } })
        await runWorker()
        expect(await location(name)).toBeNull()
        expect(bucket.files.has(key(name))).toBe(false)
    })

    test('destroys an orphan in both locations, as a move that failed half way leaves it', async () => {
        const { name } = await ombulStore.createFile(pdf)
        await fileSystemBackend.write(key(name), pdf)
        await makeOld(name)

        await runWorker()

        expect(bucket.files.has(key(name))).toBe(false)
        expect(await fileSystemBackend.exists(key(name))).toBe(false)
    })

    test('moves a file written to the other location to the wanted one', async () => {
        const write = jest.spyOn(bucket, 'write').mockRejectedValueOnce(new Error('The bucket is full'))
        const { name } = await ombulStore.createFile(pdf)
        expect(await location(name)).toBe('VOLUME')
        write.mockRestore()

        await runWorker()

        expect(await location(name)).toBe('S3')
        expect(bucket.files.get(key(name))).toEqual(pdf)
        expect(await fileSystemBackend.exists(key(name))).toBe(false)
    })

    test('leaves a file where it is while the wanted location refuses it', async () => {
        jest.spyOn(bucket, 'write').mockRejectedValue(new Error('The bucket is full'))
        const { name } = await ombulStore.createFile(pdf)

        await runWorker()

        expect(await location(name)).toBe('VOLUME')
        expect(await fileSystemBackend.read(key(name))).toEqual(pdf)
        await fileSystemBackend.destroy(key(name))
    })

    test('corrects a row that is wrong about where its file is', async () => {
        const { name } = await ombulStore.createFile(pdf)
        await prisma.storeFile.update({ where: { name }, data: { location: 'VOLUME' } })

        await runWorker()

        expect(await location(name)).toBe('S3')
        expect(bucket.files.get(key(name))).toEqual(pdf)
    })

    test('reports progress for a file it only corrects the row of, so a long run is not taken for stuck', async () => {
        const { name } = await ombulStore.createFile(pdf)
        await prisma.storeFile.update({ where: { name }, data: { location: 'VOLUME' } })
        const progress = jest.fn()

        await ombulStore.worker.tick(progress)

        expect(await location(name)).toBe('S3')
        expect(progress).toHaveBeenCalled()
    })

    test('takes the volume for the wanted location when no bucket is in use', async () => {
        const { name } = await ombulStore.createFile(pdf)
        await fileSystemBackend.write(key(name), pdf)
        storeBackends.S3 = null

        await runWorker()

        expect(await location(name)).toBe('VOLUME')
        await fileSystemBackend.destroy(key(name))
    })

    test('says how many files are in a bucket that is no longer in use, and leaves their rows alone', async () => {
        const { name } = await ombulStore.createFile(pdf)
        storeBackends.S3 = null
        const error = jest.spyOn(logger, 'error')

        await runWorker()

        const messages = error.mock.calls
            .map(([message]): unknown => message)
            .filter((message): message is string => typeof message === 'string')
        expect(messages).toContainEqual(expect.stringMatching(
            /^\d+ store file\(s\) of OMBUL are recorded in S3, which is not in use$/
        ))
        // It is not lost: its content is where the row says, which is only out of reach.
        expect(messages.filter(message => message.includes('are lost'))).toEqual([])
        expect(await location(name)).toBe('S3')
    })

    test('reports a lost file with the row that refers to it, and keeps both', async () => {
        storeBackends.S3 = null
        const { name } = await ombulStore.createFile(pdf)
        const ombul = await createOmbulOf(name)
        await fileSystemBackend.destroy(key(name))
        const error = jest.spyOn(logger, 'error')

        await runWorker()

        expect(error.mock.calls).toContainEqual([
            expect.stringMatching(/^\d+ store file\(s\) of OMBUL are lost, since their content is in no location$/),
            { files: expect.arrayContaining([expect.objectContaining({ name, ombul: { id: ombul.id } })]) },
        ])
        expect(await location(name)).toBe('VOLUME')
        expect(await prisma.ombul.findUnique({ where: { id: ombul.id } })).not.toBeNull()

        await prisma.ombul.delete({ where: { id: ombul.id } })
    })

    test('reports a file a row of another purpose refers to, and leaves it alone', async () => {
        const { name } = await ombulStore.createFile(pdf)
        const misused = await ombulStore.createFile(pdf)
        // The cover image of this ombul has a file of the ombul purpose for its original.
        const ombul = await createOmbulOf(name, misused.name)
        await makeOld(name, misused.name)
        const error = jest.spyOn(logger, 'error')

        await runWorker()

        expect(error.mock.calls).toContainEqual([
            '1 store file(s) of OMBUL are referred to through another relation than ombul',
            { files: [expect.objectContaining({ name: misused.name, originalOfImage: { id: ombul.coverImageId } })] },
        ])
        expect(await location(misused.name)).toBe('S3')
    })
})

describe('findLostFilesOnVolume', () => {
    /** The ombul purpose as it would be if it kept its files on the volume and could make them again. */
    const repairable = (repairLost: (names: string[]) => void) => ({
        purpose: 'OMBUL', preferredLocation: 'VOLUME', owners: ['ombul'], repairLost,
    } as const)

    test('hands the lost files a row refers to to the repair of the purpose, and reports no error', async () => {
        storeBackends.S3 = null
        const referred = await ombulStore.createFile(pdf)
        const orphan = await ombulStore.createFile(pdf)
        const present = await ombulStore.createFile(pdf)
        const ombul = await createOmbulOf(referred.name)
        const other = await createOmbulOf(present.name)
        await fileSystemBackend.destroy(key(referred.name))
        await fileSystemBackend.destroy(key(orphan.name))
        const repairLost = jest.fn<(names: string[]) => void>()
        const error = jest.spyOn(logger, 'error')

        await findLostFilesOnVolume(repairable(repairLost))

        const repaired = repairLost.mock.calls.flat(2)
        expect(repaired).toContain(referred.name)
        expect(repaired).not.toContain(orphan.name)
        expect(repaired).not.toContain(present.name)
        expect(error).not.toHaveBeenCalled()

        await prisma.ombul.deleteMany({ where: { id: { in: [ombul.id, other.id] } } })
        await fileSystemBackend.destroy(key(present.name))
    })

    test('corrects the row of a file that is in the other location, which is not lost', async () => {
        const { name } = await ombulStore.createFile(pdf)
        const ombul = await createOmbulOf(name)
        await prisma.storeFile.update({ where: { name }, data: { location: 'VOLUME' } })
        const repairLost = jest.fn<(names: string[]) => void>()

        await findLostFilesOnVolume(repairable(repairLost))

        expect(await location(name)).toBe('S3')
        expect(repairLost.mock.calls.flat(2)).not.toContain(name)

        await prisma.ombul.delete({ where: { id: ombul.id } })
    })

    test('leaves a purpose that wants its files in the bucket alone, since the move reads those', async () => {
        const { name } = await ombulStore.createFile(pdf)
        await prisma.storeFile.update({ where: { name }, data: { location: 'VOLUME' } })

        const lost = await findLostFilesOnVolume({ purpose: 'OMBUL', preferredLocation: 'S3', owners: ['ombul'] })

        expect(lost).toBe(0)
        expect(await location(name)).toBe('VOLUME')
    })
})

describe('streamStoreFile', () => {
    const contentOf = async (stream: ReadableStream | null) => (
        stream ? Buffer.from(await new Response(stream).arrayBuffer()) : null
    )

    test('serves a file from its directory alone', async () => {
        const { name } = await ombulStore.createFile(pdf)

        expect(await contentOf(await streamStoreFile('ombul', name))).toEqual(pdf)
        expect(await streamStoreFile('images', name)).toBeNull()
        expect(await streamStoreFile('ombul', 'unknown.pdf')).toBeNull()
    })

    test('serves nothing without a row, also when there is content', async () => {
        await fileSystemBackend.write(key('untracked.pdf'), pdf)

        expect(await streamStoreFile('ombul', 'untracked.pdf')).toBeNull()
        expect(await streamStoreFile('ombul', '../ombul/untracked.pdf')).toBeNull()

        await fileSystemBackend.destroy(key('untracked.pdf'))
    })
})

describe('createUntrackedFileDestroyer', () => {
    const hourMs = 60 * 60 * 1000
    const dayMs = 24 * hourMs

    test('destroys a file only once it has been without a row on every run for the whole delay', async () => {
        await bucket.write(key('untracked.pdf'), pdf)
        await bucket.write(key('seeded-later.pdf'), pdf)
        const tracked = new Set<string>()
        const destroyUntrackedFiles = createUntrackedFileDestroyer({
            list: batchSize => bucket.list('ombul', batchSize),
            destroy: name => bucket.destroy(key(name)),
        }, {
            confirmAfterMs: dayMs,
            context: 'a directory',
            tracked: names => new Set(names.filter(name => tracked.has(name))),
        })
        const start = Date.now()

        expect(await destroyUntrackedFiles({ now: start })).toBe(0)

        // A row for it turns up between two runs, as it would once seeding gets to it.
        tracked.add('seeded-later.pdf')
        expect(await destroyUntrackedFiles({ now: start + 12 * hourMs })).toBe(0)
        tracked.delete('seeded-later.pdf')

        expect(await destroyUntrackedFiles({ now: start + dayMs })).toBe(1)
        expect(bucket.files.has(key('untracked.pdf'))).toBe(false)
        // Without a row again, but only since the last run, so its wait starts over.
        expect(bucket.files.has(key('seeded-later.pdf'))).toBe(true)
    })

    test('reports each batch, so a long run is not taken for stuck', async () => {
        const onBatch = jest.fn()
        const destroyUntrackedFiles = createUntrackedFileDestroyer({
            // eslint-disable-next-line @typescript-eslint/require-await
            async *list() {
                yield ['first.pdf']
                yield ['second.pdf']
            },
            destroy: () => { throw new Error('Nothing here is untracked') },
        }, {
            context: 'a directory',
            tracked: names => new Set(names),
        })

        await destroyUntrackedFiles({ onBatch })

        expect(onBatch).toHaveBeenCalledTimes(2)
    })
})
