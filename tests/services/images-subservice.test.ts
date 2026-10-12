import '@pn-server-only'
import { prisma } from '@/prisma-pn-client-instance'
import { imageOperations } from '@/services/images/subservice/operations'
import { allowedExtensions } from '@/services/images/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { imageSourceForResolution, srcSetForImage } from '@/lib/images/imageSource'
import { beforeEach, describe, expect, test } from '@jest/globals'
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
    test('deletes every image file in the store when collection is destroyed', async () => {
        const image1 = await uploadAndProcessImage('Test Image 1')
        const image2 = await uploadAndProcessImage('Test Image 2')
        const allFsLocations = [...image1.allFsLocations, ...image2.allFsLocations]

        await expectFilesExist(allFsLocations, true)

        await imageOperations.destroyCollection.internalCall({
            prisma,
            params: { collectionId },
        })

        expect(await prisma.imageCollection.findUnique({ where: { id: collectionId } })).toBeNull()
        await expectFilesExist(allFsLocations, false)
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
        await expectFilesExist(image.allFsLocations, false)
    })

    test('deletes the original of an image whose variants were never processed', async () => {
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

        expect(await fileExists(image.fsLocationOriginal)).toBe(false)
    })
})
