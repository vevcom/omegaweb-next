import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { imageOperations } from '@/services/images/subservice/operations'
import { cacheImageStore, originalImageStore } from '@/services/images/subservice/imageFiles'
import { fileSystemBackend } from '@/services/store/backends/fileSystem'
import { storeUpkeep } from '@/services/store/constants'
import { allowedExtensions } from '@/services/images/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { imageSourceForResolution, srcSetForImage } from '@/lib/images/imageSource'
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { access, unlink } from 'fs/promises'
import { join } from 'path'
import { File } from 'node:buffer'

let collectionId: number

// Minimal valid PNG (1x1 red pixel)
const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x9c, 0xe3, 0xbf, 0x59, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
])

function storePath(fsLocation: string): string {
    return join('store', 'images', fsLocation)
}

async function fileExists(fsLocation: string): Promise<boolean> {
    try {
        await access(storePath(fsLocation))
        return true
    } catch {
        return false
    }
}

async function createTestCollection(): Promise<number> {
    const visibilityAdmin = await visibilityOperations.create.internalCall({ prisma })
    const visibilityRegular = await visibilityOperations.create.internalCall({ prisma })

    const collection = await prisma.imageCollection.create({
        data: {
            name: `Image Subservice Test Collection ${Date.now()}`,
            description: 'Test collection',
            visibilityAdminId: visibilityAdmin.id,
            visibilityRegularId: visibilityRegular.id,
        },
    })
    return collection.id
}

/**
 * Uploads a raster image and runs the variant processing the background worker would otherwise
 * do, so the image ends up with every file it can have in the store.
 */
async function uploadAndProcessImage(imageName: string) {
    const imageFile = new File([pngBuffer], 'test.png', { type: 'image/png' })
    const uploaded = await imageOperations.uploadImage.internalCall({
        prisma,
        params: { collectionId },
        data: {
            imageFile,
            imageName,
            imageAlt: `${imageName} alt text`,
            imageLicenseId: undefined,
            imageCredit: undefined,
        },
        operationImplementationFields: { uploadAsStandardImage: null, allowedExtensions }
    })

    const processing = await imageOperations.processImageVariants.internalCall({
        prisma,
        params: { imageId: uploaded.id },
    })
    expect(processing.success).toBe(true)

    const { processedFiles, ...image } = await prisma.image.findUniqueOrThrow({
        where: { id: uploaded.id },
        include: { processedFiles: true },
    })
    if (!processedFiles) throw new Error('Image variants were not processed')

    return {
        ...image,
        processedFiles,
        // The 1x1 test fixture is narrower than every tier above tiny. Those tiers get skipped
        // and come back null here. See createRasterVariants.
        allFsLocations: [
            image.fsLocationOriginal,
            processedFiles.fsLocationMicroSize,
            processedFiles.fsLocationTinySize,
            processedFiles.fsLocationSmallSize,
            processedFiles.fsLocationMediumSize,
            processedFiles.fsLocationLargeSize,
            processedFiles.fsLocationHugeSize,
        ].filter((fsLocation): fsLocation is string => fsLocation !== null),
    }
}

async function expectFilesExist(fsLocations: string[], exists: boolean) {
    const existence = await Promise.all(fsLocations.map(fileExists))
    expect(existence).toEqual(fsLocations.map(() => exists))
}

/**
 * Runs the store's workers for the images as if the given files were made long ago, since a file
 * is only taken for an orphan once it is older than the grace period.
 */
async function runStoreWorkers(fsLocations: string[]) {
    await prisma.storeFile.updateMany({
        where: { name: { in: fsLocations } },
        data: { createdAt: new Date(Date.now() - 2 * storeUpkeep.orphanGraceMs) },
    })
    await originalImageStore.worker.tick(() => undefined)
    await cacheImageStore.worker.tick(() => undefined)
}

beforeEach(async () => {
    collectionId = await createTestCollection()
})

describe('processImageVariants', () => {
    test('skips tiers no wider than the source, keeping only tiny for a 1x1 image', async () => {
        const image = await uploadAndProcessImage('Tiny Source Image')

        expect(image.processedFiles.fsLocationMicroSize).toBeNull()
        expect(image.processedFiles.fsLocationTinySize).not.toBeNull()
        expect(image.processedFiles.fsLocationSmallSize).toBeNull()
        expect(image.processedFiles.fsLocationMediumSize).toBeNull()
        expect(image.processedFiles.fsLocationLargeSize).toBeNull()
        expect(image.processedFiles.fsLocationHugeSize).toBeNull()
    })

    test('records the actual encoded width/height of every produced variant', async () => {
        const image = await uploadAndProcessImage('Tiny Source Image')

        // Fixture is 1x1, so every produced tier stays 1x1. withoutEnlargement never scales up.
        expect(image.processedFiles.widthMicroSize).toBeNull()
        expect(image.processedFiles.heightMicroSize).toBeNull()
        expect(image.processedFiles.widthTinySize).toBe(1)
        expect(image.processedFiles.heightTinySize).toBe(1)
        expect(image.processedFiles.widthSmallSize).toBeNull()
        expect(image.processedFiles.heightSmallSize).toBeNull()
        expect(image.processedFiles.widthMediumSize).toBeNull()
        expect(image.processedFiles.heightMediumSize).toBeNull()
        expect(image.processedFiles.widthLargeSize).toBeNull()
        expect(image.processedFiles.heightLargeSize).toBeNull()
        expect(image.processedFiles.widthHugeSize).toBeNull()
        expect(image.processedFiles.heightHugeSize).toBeNull()
    })

    test('serving a skipped tier falls back to the largest tier that was actually produced', async () => {
        const image = await uploadAndProcessImage('Tiny Source Image')

        const hugeSource = imageSourceForResolution(image, 'HUGE')
        const largeSource = imageSourceForResolution(image, 'LARGE')
        const tinySource = imageSourceForResolution(image, 'TINY')
        const microSource = imageSourceForResolution(image, 'MICRO')

        expect(hugeSource).toBe(`/store/images/${image.processedFiles.fsLocationTinySize}`)
        expect(largeSource).toBe(`/store/images/${image.processedFiles.fsLocationTinySize}`)
        expect(tinySource).toBe(`/store/images/${image.processedFiles.fsLocationTinySize}`)
        // micro is smaller than tiny, so a missing micro falls back up to tiny instead of down.
        expect(microSource).toBe(`/store/images/${image.processedFiles.fsLocationTinySize}`)
    })

    test('a store outage costs no attempt, but a missing original does', async () => {
        const { id } = await uploadAndProcessImage('Unprocessed Image')
        await prisma.processedImageFiles.delete({ where: { imageId: id } })
        const attempts = async () => (await prisma.image.findUniqueOrThrow({ where: { id } })).processingAttempts
        // The worker counts an attempt when it claims an image, before processing it.
        const processClaimed = async () => {
            await prisma.image.update({ where: { id }, data: { processingAttempts: { increment: 1 } } })
            return await imageOperations.processImageVariants.internalCall({ prisma, params: { imageId: id } })
        }
        const read = jest.spyOn(fileSystemBackend, 'read')
        const write = jest.spyOn(fileSystemBackend, 'write')

        read.mockRejectedValueOnce(new Error('The store did not answer'))
        const unreadable = await processClaimed()
        expect(unreadable.success).toBe(false)
        expect(await attempts()).toBe(0)

        write.mockRejectedValueOnce(new Error('The store did not answer'))
        const unwritable = await processClaimed()
        expect(unwritable.success).toBe(false)
        expect(await attempts()).toBe(0)

        read.mockResolvedValueOnce(null)
        const missing = await processClaimed()
        expect(missing.success).toBe(false)
        expect(await attempts()).toBe(1)

        read.mockRestore()
        write.mockRestore()
    })
})

describe('srcSetForImage', () => {
    test('lists one url/width entry per populated tier, smallest first', async () => {
        const image = await uploadAndProcessImage('Tiny Source Image')

        // Only tiny is populated for this 1x1 fixture. See processImageVariants describe block.
        expect(srcSetForImage(image)).toBe(`/store/images/${image.processedFiles.fsLocationTinySize} 1w`)
    })

    test('is undefined for an image whose variants were never processed', async () => {
        const imageFile = new File([pngBuffer], 'test.png', { type: 'image/png' })
        const image = await imageOperations.uploadImage.internalCall({
            prisma,
            params: { collectionId },
            data: {
                imageFile,
                imageName: 'Unprocessed Image',
                imageAlt: 'Unprocessed alt text',
                imageLicenseId: undefined,
                imageCredit: undefined,
            },
            operationImplementationFields: { uploadAsStandardImage: null, allowedExtensions }
        })

        expect(srcSetForImage(image)).toBeUndefined()
    })
})

describe('destroyCollection', () => {
    test('leaves every image file as an orphan, which the store workers destroy', async () => {
        const image1 = await uploadAndProcessImage('Test Image 1')
        const image2 = await uploadAndProcessImage('Test Image 2')
        const allFsLocations = [...image1.allFsLocations, ...image2.allFsLocations]

        await expectFilesExist(allFsLocations, true)

        await imageOperations.destroyCollection.internalCall({
            prisma,
            params: { collectionId },
        })

        expect(await prisma.imageCollection.findUnique({ where: { id: collectionId } })).toBeNull()
        await expectFilesExist(allFsLocations, true)

        await runStoreWorkers(allFsLocations)

        await expectFilesExist(allFsLocations, false)
        expect(await prisma.storeFile.count({ where: { name: { in: allFsLocations } } })).toBe(0)
    })

    test('handles gracefully when some files are already missing', async () => {
        const image = await uploadAndProcessImage('Test Image')

        // Manually delete one variant to simulate a missing file
        await unlink(storePath(image.processedFiles.fsLocationTinySize))

        await expect(imageOperations.destroyCollection.internalCall({
            prisma,
            params: { collectionId },
        })).resolves.not.toThrow()

        expect(await prisma.imageCollection.findUnique({ where: { id: collectionId } })).toBeNull()
        await runStoreWorkers(image.allFsLocations)
        await expectFilesExist(image.allFsLocations, false)
        expect(await prisma.storeFile.count({ where: { name: { in: image.allFsLocations } } })).toBe(0)
    })

    test('leaves the original of an image whose variants were never processed as an orphan too', async () => {
        const imageFile = new File([pngBuffer], 'test.png', { type: 'image/png' })
        const image = await imageOperations.uploadImage.internalCall({
            prisma,
            params: { collectionId },
            data: {
                imageFile,
                imageName: 'Unprocessed Image',
                imageAlt: 'Unprocessed alt text',
                imageLicenseId: undefined,
                imageCredit: undefined,
            },
            operationImplementationFields: { uploadAsStandardImage: null, allowedExtensions }
        })
        expect(image.processedFiles).toBeNull()
        expect(await fileExists(image.fsLocationOriginal)).toBe(true)

        await imageOperations.destroyCollection.internalCall({
            prisma,
            params: { collectionId },
        })
        await runStoreWorkers([image.fsLocationOriginal])

        expect(await fileExists(image.fsLocationOriginal)).toBe(false)
    })

    test('refuses, keeping the collection, when one of its images is used as a flair', async () => {
        const image = await uploadAndProcessImage('Flair Image')
        // The seeded flairs take their ranks explicitly, so the rank sequence cannot be trusted here.
        const highestRank = await prisma.flair.aggregate({ _max: { rank: true } })
        await prisma.flair.create({
            data: { name: 'Test flair', imageId: image.id, rank: (highestRank._max.rank ?? 0) + 1 },
        })

        await expect(imageOperations.destroyCollection.internalCall({
            prisma,
            params: { collectionId },
        })).rejects.toMatchObject({ errorCode: 'BAD PARAMETERS' })

        expect(await prisma.imageCollection.findUnique({ where: { id: collectionId } })).not.toBeNull()
        await runStoreWorkers(image.allFsLocations)
        await expectFilesExist(image.allFsLocations, true)
    })
})

describe('a lost variant', () => {
    test('has its image processed again by the worker of the variants', async () => {
        const image = await uploadAndProcessImage('Lost Variant Image')
        await unlink(storePath(image.processedFiles.fsLocationTinySize))

        await cacheImageStore.worker.tick(() => undefined)

        const waiting = await prisma.image.findUniqueOrThrow({
            where: { id: image.id },
            include: { processedFiles: true },
        })
        expect(waiting.processedFiles).toBeNull()
        expect(waiting.processingAttempts).toBe(0)
        expect(waiting.processingStartedAt).toBeNull()
        // The blur placeholder stands in until the variants are back.
        expect(imageSourceForResolution(waiting, 'TINY')).toBe(image.placeholderDataUrl)

        const processing = await imageOperations.processImageVariants.internalCall({
            prisma,
            params: { imageId: image.id },
        })
        expect(processing.success).toBe(true)
        const { fsLocationTinySize } = await prisma.processedImageFiles.findUniqueOrThrow({ where: { imageId: image.id } })
        expect(fsLocationTinySize).not.toBe(image.processedFiles.fsLocationTinySize)
        expect(await fileExists(fsLocationTinySize)).toBe(true)

        // What is left of the old variants goes as orphans.
        const oldVariants = image.allFsLocations.filter(fsLocation => fsLocation !== image.fsLocationOriginal)
        await runStoreWorkers(oldVariants)
        expect(await prisma.storeFile.count({ where: { name: { in: oldVariants } } })).toBe(0)
        expect(await fileExists(image.fsLocationOriginal)).toBe(true)
    })

    test('leaves an image alone while every variant is there', async () => {
        const image = await uploadAndProcessImage('Whole Image')

        await cacheImageStore.worker.tick(() => undefined)

        const { fsLocationTinySize } = await prisma.processedImageFiles.findUniqueOrThrow({ where: { imageId: image.id } })
        expect(fsLocationTinySize).toBe(image.processedFiles.fsLocationTinySize)
    })
})

describe('destroyImage', () => {
    test('deletes the image, and its files go once the store workers have run', async () => {
        const image = await uploadAndProcessImage('Deleted Image')

        await imageOperations.destroyImage.internalCall({ prisma, params: { imageId: image.id } })
        await expectFilesExist(image.allFsLocations, true)

        await runStoreWorkers(image.allFsLocations)
        await expectFilesExist(image.allFsLocations, false)
    })
})

describe('replaceImageFile', () => {
    test('swaps the original, and the old files go once the store workers have run', async () => {
        const image = await uploadAndProcessImage('Replaced Image')
        const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'new.svg', { type: 'image/svg+xml' })

        const { replaced } = await imageOperations.replaceImageFile.internalCall({
            prisma,
            params: { imageId: image.id },
            data: { imageFile: svg },
            operationImplementationFields: { allowedExtensions },
        })
        expect(replaced).toBe(true)
        const { fsLocationOriginal } = await prisma.image.findUniqueOrThrow({ where: { id: image.id } })
        expect(fsLocationOriginal).not.toBe(image.fsLocationOriginal)

        await runStoreWorkers([...image.allFsLocations, fsLocationOriginal])
        await expectFilesExist(image.allFsLocations, false)
        expect(await fileExists(fsLocationOriginal)).toBe(true)
    })
})
