import '@pn-server-only'
import { imageSchemas } from './schemas'
import {
    allowedExtensions,
    avifConvertionOptions,
    expandedImageIncluder,
    imageSizes,
    type ImageExtension,
    type expandedImageCollectionIncluder
} from './constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError, Smorekopp } from '@/services/error'
import { implementStore } from '@/lib/store/implementStore'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import logger from '@/lib/logger'
import sharp from 'sharp'
import { File } from 'node:buffer'
import type { Prisma, StandardImage } from '@/prisma-generated-pn-types'
import type { ExpandedImage, ExpandedImageCollection } from './types'
import type { z } from 'zod'

const imageStore = implementStore({
    staticStorePrefix: 'images',
    allowedExtentions: allowedExtensions,
})

export const imageOperations = {
    destroyCollection: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaCollection,
        opensTransaction: true,
        operation: () => async ({ prisma, params }) => {
            const collection = await prisma.imageCollection.findUnique({
                where: uniqueCollectionWhere(params),
                include: {
                    images: {
                        select: {
                            fsLocationOriginal: true,
                            processedFiles: true,
                        }
                    }
                }
            })
            if (!collection) throw new ServiceError('NOT FOUND', 'Collection ikke funnet')

            // Extract all file locations before deleting from DB
            const fileLocationsToDelete = collection.images.flatMap(storedFileLocationsOfImage)

            await prisma.$transaction(async (tx) => {
                await tx.imageCollection.delete({
                    where: uniqueCollectionWhere(params),
                })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: collection.visibilityAdminId },
                })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: collection.visibilityRegularId },
                })
            })

            // Clean up files after transaction succeeds
            await destroyStoredFiles(fileLocationsToDelete, 'collection deletion')
        }
    }),
    updateCollection: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaCollection,
        dataSchema: () => imageSchemas.updateCollection,
        operation: () => async ({ prisma, params, data }) => {
            if (data.coverImageId !== undefined) {
                const image = await prisma.image.findUnique({
                    where: { id: data.coverImageId },
                    select: { collectionId: true }
                })

                if (!image) {
                    throw new ServiceError('NOT FOUND', 'Bilde ikke funnet')
                }

                const collectionId = 'collectionId' in params
                    ? params.collectionId
                    : (await prisma.imageCollection.findFirstOrThrow({
                        where: { name: params.collectionName },
                        select: { id: true }
                    })).id

                if (image.collectionId !== collectionId) {
                    throw new Smorekopp(
                        'BAD DATA',
                        'Bildet må tilhøre samlingen du redigerer'
                    )
                }
            }

            return prisma.imageCollection.update({
                where: uniqueCollectionWhere(params),
                data: {
                    name: data.collectionName,
                    description: data.collectionDescription,
                    coverImage: {
                        connect: data.coverImageId ? {
                            id: data.coverImageId
                        } : undefined
                    }
                }
            })
        }
    }),

    /**
     * On upload time, only the original is saved to the store synchronously (plus a tiny inline
     * blur placeholder) - the real resized/avif variants are produced in the background by
     * processImageVariants, so this stays fast enough to run inside a caller's transaction.
     *
     * Svg uploads skip all of that: a vector is already the right file at every resolution, so
     * there is nothing to resize and nothing to stand in while it happens.
     *
     * Which extensions this implementation accepts is decided by the implementer - committee logos
     * take svg only, profile images and ombul covers take raster only, and the rest take everything.
     */
    uploadImage: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaCollection,
        dataSchema: () => imageSchemas.uploadImage,
        operation: (
            { uploadAsStandardImage, allowedExtensions }: {
                uploadAsStandardImage: StandardImage | null,
                allowedExtensions: readonly ImageExtension[],
            }
        ) => async ({ prisma, params, data }) => {
            const { imageFile, ...meta } = data
            // createFile is the single gate on file type: it rejects anything outside this
            // implementation's subset, and hands back the canonical extension - which is also what
            // decides whether this is a vector or something the worker has to resize.
            const original = await imageStore.createFile(imageFile, allowedExtensions)
            const sharedImageData = {
                name: meta.imageName,
                alt: meta.imageAlt,
                license: meta.imageLicenseId ? { connect: { id: meta.imageLicenseId } } : undefined,
                credit: meta.imageCredit,
                standardImage: uploadAsStandardImage,
                fsLocationOriginal: original.fsLocation,
                extOriginal: original.ext,
                collection: {
                    connect: uniqueCollectionWhere(params)
                }
            }

            if (original.ext === 'svg') {
                return await prisma.image.create({
                    data: {
                        ...sharedImageData,
                        type: 'SVG',
                        placeholderDataUrl: null,
                    },
                    include: expandedImageIncluder,
                })
            }

            const buffer = Buffer.from(await imageFile.arrayBuffer())
            const { data: placeholderBuffer } = await resizeToAvifBuffer(buffer, imageSizes.placeholder)

            return await prisma.image.create({
                data: {
                    ...sharedImageData,
                    type: 'RASTER',
                    placeholderDataUrl: `data:image/avif;base64,${placeholderBuffer.toString('base64')}`,
                },
                include: expandedImageIncluder,
            })
        }
    }),

    /**
     * Swaps the file behind an existing image in place, keeping its id - and with it every relation
     * pointing at it - intact. The new original is stored the same way uploadImage stores one, the
     * old variants are dropped so the background worker produces fresh ones, and the old files are
     * removed once the row points at the new ones.
     *
     * Nothing is written when the new file is byte for byte the stored original, so this is cheap to
     * call on every run for an image whose source of truth lives outside the database.
     */
    replaceImageFile: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        dataSchema: () => imageSchemas.replaceImageFile,
        opensTransaction: true,
        operation: (
            { allowedExtensions }: { allowedExtensions: readonly ImageExtension[] }
        ) => async ({ prisma, params, data: { imageFile } }) => {
            const image = await prisma.image.findUniqueOrThrow({
                where: { id: params.imageId },
                include: expandedImageIncluder,
            })

            const buffer = Buffer.from(await imageFile.arrayBuffer())
            const storedOriginal = await imageStore.readStoredFile(image.fsLocationOriginal).catch(error => {
                // A missing original is exactly what replacing it repairs.
                if (error instanceof ServiceError && error.errorCode === 'NOT FOUND') return null
                throw error
            })
            if (storedOriginal?.equals(buffer)) return { replaced: false }

            const original = await imageStore.createFile(imageFile, allowedExtensions)
            const placeholderDataUrl = original.ext === 'svg'
                ? null
                : `data:image/avif;base64,${
                    (await resizeToAvifBuffer(buffer, imageSizes.placeholder)).data.toString('base64')
                }`

            await prisma.$transaction(async (tx) => {
                await tx.processedImageFiles.deleteMany({
                    where: { imageId: image.id },
                })
                await tx.image.update({
                    where: { id: image.id },
                    data: {
                        type: original.ext === 'svg' ? 'SVG' : 'RASTER',
                        fsLocationOriginal: original.fsLocation,
                        extOriginal: original.ext,
                        placeholderDataUrl,
                        processingStartedAt: null,
                        processingAttempts: 0,
                        processingError: null,
                    }
                })
            })

            await destroyStoredFiles(storedFileLocationsOfImage(image), 'image file replacement')
            return { replaced: true }
        }
    }),

    /**
     * Produces the real avif variants for an already-uploaded image.
     * See createRasterVariants for which tiers get skipped.
     * Called by the background worker container (src/lib/images/worker.ts), never directly from a request.
     */
    processImageVariants: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }) => {
            const image = await prisma.image.findUniqueOrThrow({ where: { id: params.imageId } })
            if (image.type !== 'RASTER') {
                throw new ServiceError('BAD PARAMETERS', `Image ${image.id} is an svg and has no variants to process`)
            }
            try {
                const buffer = await imageStore.readStoredFile(image.fsLocationOriginal)
                const variants = await createRasterVariants(buffer)
                await prisma.processedImageFiles.create({
                    data: {
                        imageId: image.id,
                        fsLocationMicroSize: variants.micro?.fsLocation,
                        widthMicroSize: variants.micro?.width,
                        heightMicroSize: variants.micro?.height,
                        fsLocationTinySize: variants.tiny.fsLocation,
                        widthTinySize: variants.tiny.width,
                        heightTinySize: variants.tiny.height,
                        fsLocationSmallSize: variants.small?.fsLocation,
                        widthSmallSize: variants.small?.width,
                        heightSmallSize: variants.small?.height,
                        fsLocationMediumSize: variants.medium?.fsLocation,
                        widthMediumSize: variants.medium?.width,
                        heightMediumSize: variants.medium?.height,
                        fsLocationLargeSize: variants.large?.fsLocation,
                        widthLargeSize: variants.large?.width,
                        heightLargeSize: variants.large?.height,
                        fsLocationHugeSize: variants.huge?.fsLocation,
                        widthHugeSize: variants.huge?.width,
                        heightHugeSize: variants.huge?.height,
                    }
                })
                return { success: true }
            } catch (error) {
                await prisma.image.update({
                    where: { id: image.id },
                    data: {
                        processingAttempts: { increment: 1 },
                        processingError: String(error),
                    }
                })
                return { success: false, error: String(error) }
            }
        }
    }),

    /**
     * Manual escape hatch for images stuck in processingStatus 'FAILED' - resets the bookkeeping
     * so the next worker tick picks it up again.
     */
    retryImageProcessing: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }) => {
            await prisma.image.update({
                where: { id: params.imageId },
                data: {
                    processingAttempts: 0,
                    processingStartedAt: null,
                    processingError: null,
                }
            })
        }
    }),

    uploadManyImages: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaUploadManyImages,
        dataSchema: () => imageSchemas.uploadManyImages,
        operation: (
            { allowedExtensions }: { allowedExtensions: readonly ImageExtension[] }
        ) => async ({ params, data }) => {
            for (const imageFile of data.imageFiles) {
                const imageName = params.useFileName ? imageFile.name.split('.')[0] : undefined
                await imageOperations.uploadImage.internalCall({
                    params: {
                        collectionId: params.collectionId,
                    },
                    data: {
                        imageFile,
                        imageName,
                        imageAlt: imageFile.name.split('.')[0],
                        imageLicenseId: data.imageLicenseId,
                        imageCredit: data.imageCredit
                    },
                    operationImplementationFields: { uploadAsStandardImage: null, allowedExtensions }
                })
            }
        }
    }),

    readPageOfImagesInCollection: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaReadPageOfImagesInCollection,
        operation: () => async ({ prisma, params }) => {
            const { cursor, ...rest } = cursorPagingSelection(params.paging.page)
            return await prisma.image.findMany({
                where: {
                    collectionId: params.collectionId,
                },
                include: expandedImageIncluder,
                ...rest,
                cursor: cursor ? { id: cursor.imageId } : undefined,
            })
        },
    }),

    updateImageMeta: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        dataSchema: () => imageSchemas.updateImageMeta,
        operation: () => async ({ prisma, params, data }) =>
            await prisma.image.update({
                where: {
                    id: params.imageId,
                },
                include: expandedImageIncluder,
                data: {
                    license: data.imageLicenseId !== undefined ? {
                        ...(data.imageLicenseId ? { connect: { id: data.imageLicenseId } } : { disconnect: true })
                    } : undefined,
                    name: data.imageName,
                    alt: data.imageAlt,
                    credit: data.imageCredit,
                }
            })
    }),

    /**
     * Deletes image from database and returns a cleanup function for file deletion.
     * Used inside transactions: delete DB row in the transaction, call cleanup function after it commits.
     * Prevents files from being deleted if the transaction rolls back.
     */
    destroyImageDbAndReturnCleanup: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }): Promise<() => Promise<void>> => {
            const image = await prisma.image.findUniqueOrThrow({
                where: {
                    id: params.imageId,
                },
                include: expandedImageIncluder,
            })
            await prisma.image.delete({
                where: {
                    id: params.imageId,
                },
            })
            // Return a cleanup function that the caller invokes after the transaction succeeds
            return async () => destroyStoredFiles(storedFileLocationsOfImage(image), 'image deletion')
        }
    }),

    /**
     * Full destroy operation: deletes image from database and then cleans up files.
     * Use this for standalone operations outside transactions.
     * For use inside transactions, use destroyImageDbAndReturnCleanup and call the returned cleanup function.
     */
    destroyImage: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }) => {
            const cleanup =
                await imageOperations.destroyImageDbAndReturnCleanup.internalCall({
                    prisma,
                    params
                })
            await cleanup()
        }
    }),

    readCollectionOfImage: defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }) =>
            (await prisma.image.findUniqueOrThrow({
                where: {
                    id: params.imageId,
                },
                select: {
                    collection: true,
                }
            })).collection
    })
} as const

/**
 * Resizes the buffer down to the given width and encodes it as avif.
 * Only width is passed to sharp. Height scales automatically, so aspect ratio is preserved.
 * withoutEnlargement means a narrower source is returned unchanged instead of upscaled.
 * resolveWithObject also returns the real encoded width and height.
 */
async function resizeToAvifBuffer(buffer: Buffer, width: number) {
    return await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .toFormat('avif')
        .avif(avifConvertionOptions)
        .toBuffer({ resolveWithObject: true })
}

async function createResizedAvifInStore(buffer: Buffer, width: number) {
    const { data, info } = await resizeToAvifBuffer(buffer, width)
    const avifFile = new File([new Uint8Array(data)], 'image.avif', { type: 'image/avif' })
    const storedFile = await imageStore.createFile(avifFile, ['avif'])
    return { ...storedFile, width: info.width, height: info.height }
}

/**
 * Produces one avif variant per size tier.
 * tiny is always produced. Every other tier, including micro, is skipped once its target
 * width matches an already produced tier, so no two tiers ever store the same image twice.
 */
type VariantFile = Awaited<ReturnType<typeof createResizedAvifInStore>>
type LargerTier = 'small' | 'medium' | 'large' | 'huge'

async function createRasterVariants(buffer: Buffer) {
    const { width: sourceWidth = imageSizes.huge } = await sharp(buffer).metadata()

    const tinyWidth = Math.min(imageSizes.tiny, sourceWidth)
    const tiny = await createResizedAvifInStore(buffer, tinyWidth)

    const microWidth = Math.min(imageSizes.micro, sourceWidth)
    const micro = microWidth === tinyWidth ? undefined : await createResizedAvifInStore(buffer, microWidth)

    let lastWidth = tinyWidth
    const rest: Partial<Record<LargerTier, VariantFile>> = {}
    for (const tier of ['small', 'medium', 'large', 'huge'] as const) {
        const targetWidth = Math.min(imageSizes[tier], sourceWidth)
        if (targetWidth === lastWidth) continue
        rest[tier] = await createResizedAvifInStore(buffer, targetWidth)
        lastWidth = targetWidth
    }

    return { micro, tiny, ...rest }
}

/**
 * Every file in the store belonging to an image: the original, plus the resized variants if the
 * background worker has produced them yet (svgs never have any).
 */
function storedFileLocationsOfImage(image: Pick<ExpandedImage, 'fsLocationOriginal' | 'processedFiles'>): string[] {
    if (!image.processedFiles) return [image.fsLocationOriginal]
    return [
        image.fsLocationOriginal,
        image.processedFiles.fsLocationMicroSize,
        image.processedFiles.fsLocationTinySize,
        image.processedFiles.fsLocationSmallSize,
        image.processedFiles.fsLocationMediumSize,
        image.processedFiles.fsLocationLargeSize,
        image.processedFiles.fsLocationHugeSize,
    ].filter((fsLocation): fsLocation is string => fsLocation !== null)
}

/**
 * Best-effort removal of files whose database rows are already gone. A missing file is not an
 * error (it is the state we want), and one failure must not stop the rest from being attempted -
 * so failures are logged rather than thrown.
 */
async function destroyStoredFiles(fsLocations: string[], context: string): Promise<void> {
    const results = await Promise.allSettled(
        fsLocations.map(fsLocation => imageStore.destroyFile(fsLocation, undefined, false))
    )
    const errors = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    if (errors.length > 0) {
        logger.error(`Failed to clean up ${errors.length} image file(s) after ${context}`, {
            errors: errors.map(error => error.reason)
        })
    }
}

export function uniqueCollectionWhere(params: z.infer<typeof imageSchemas.paramsSchemaCollection>) {
    return (
        'collectionId' in params ? { id: params.collectionId } : { name: params.collectionName }
    ) satisfies Prisma.ImageCollectionWhereUniqueInput
}

/**
 * Enriches a collection (read with {@link expandedImageCollectionIncluder}) into the
 * ExpandedImageCollection shape. The cover image is resolved as the
 * collection's explicit cover, else its first image, else the provided default (dynamic
 * collections pass the DEFAULT_IMAGE_COLLECTION_COVER standard image).
 */
export function expandImageCollection(
    collection: Prisma.ImageCollectionGetPayload<{ include: typeof expandedImageCollectionIncluder }>,
    defaultCoverImage: ExpandedImage | null,
): ExpandedImageCollection {
    const { images, _count, ...rest } = collection
    return {
        ...rest,
        coverImage: rest.coverImage ?? images[0] ?? defaultCoverImage,
        numberOfImages: _count.images,
    }
}
