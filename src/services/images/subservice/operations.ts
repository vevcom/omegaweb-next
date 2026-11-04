import '@pn-server-only'
import { imageSchemas } from './schemas'
import {
    expandedImageIncluder,
    type ImageExtension,
} from './constants'
import {
    createRasterVariants,
    destroyStoredFiles,
    imageStore,
    placeholderDataUrlOf,
    storedFileLocationsOfImage,
} from './imageFiles'
import { uniqueCollectionWhere } from './collections'
import { visibilityOperations } from '@/services/visibility/operations'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError, Smorekopp } from '@/services/error'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import type { StandardImage } from '@/prisma-generated-pn-types'

export const imageOperations = {
    destroyCollection: defineSubOperation({
        paramsSchema: () => imageSchemas.params.destroyCollection,
        opensTransaction: true,
        operation: () => async ({ prisma, params }) => {
            const collection = await prisma.imageCollection.findUnique({
                where: uniqueCollectionWhere(params),
                include: {
                    images: {
                        select: {
                            fsLocationOriginal: true,
                            processedFiles: true,
                            // Uses of an image that refuse to let it be deleted.
                            flair: { select: { id: true } },
                            promo: { select: { id: true } },
                            ombul: { select: { id: true } },
                            committee: { select: { id: true } },
                        }
                    }
                }
            })
            if (!collection) throw new ServiceError('NOT FOUND', 'Fant ikke samlingen')

            const blockingUses = [
                { name: 'flair', used: collection.images.some(image => image.flair) },
                { name: 'promo', used: collection.images.some(image => image.promo) },
                { name: 'ombul-forside', used: collection.images.some(image => image.ombul) },
                { name: 'komitélogo', used: collection.images.some(image => image.committee) },
            ].filter(use => use.used).map(use => use.name)
            if (blockingUses.length) {
                throw new Smorekopp(
                    'BAD PARAMETERS',
                    `Samlingen kan ikke slettes fordi den har bilder som brukes som ${blockingUses.join(', ')}.`
                )
            }

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
        paramsSchema: () => imageSchemas.params.updateCollection,
        dataSchema: () => imageSchemas.data.updateCollection,
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
        paramsSchema: () => imageSchemas.params.uploadImage,
        dataSchema: () => imageSchemas.data.uploadImage,
        operation: (
            { uploadAsStandardImage, allowedExtensions }: {
                uploadAsStandardImage: StandardImage | null,
                allowedExtensions: readonly ImageExtension[],
            }
        ) => async ({ prisma, params, data }) => {
            const { imageFile, ...meta } = data
            // The file is checked before anything is written: its content decides its type, out of this
            // implementation's subset, and a raster image is decoded to make its placeholder, which turns
            // away anything sharp cannot read. The type also decides whether this is a vector or
            // something the worker has to resize.
            const buffer = Buffer.from(await imageFile.arrayBuffer())
            const ext = imageStore.storableExtension(buffer, allowedExtensions)
            const placeholderDataUrl = ext === 'svg' ? null : await placeholderDataUrlOf(buffer)

            const original = await imageStore.createFile(imageFile, allowedExtensions)
            try {
                return await prisma.image.create({
                    data: {
                        name: meta.imageName,
                        alt: meta.imageAlt,
                        license: meta.imageLicenseId ? { connect: { id: meta.imageLicenseId } } : undefined,
                        credit: meta.imageCredit,
                        standardImage: uploadAsStandardImage,
                        fsLocationOriginal: original.fsLocation,
                        extOriginal: original.ext,
                        collection: {
                            connect: uniqueCollectionWhere(params)
                        },
                        type: original.ext === 'svg' ? 'SVG' : 'RASTER',
                        placeholderDataUrl,
                    },
                    include: expandedImageIncluder,
                })
            } catch (error) {
                await destroyStoredFiles([original.fsLocation], 'a failed image upload')
                throw error
            }
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
        paramsSchema: () => imageSchemas.params.replaceImageFile,
        dataSchema: () => imageSchemas.data.replaceImageFile,
        opensTransaction: true,
        operation: (
            { allowedExtensions }: { allowedExtensions: readonly ImageExtension[] }
        ) => async ({ prisma, params, data: { imageFile } }) => {
            const image = await prisma.image.findUniqueOrThrow({
                where: { id: params.imageId },
                include: expandedImageIncluder,
            })

            const buffer = Buffer.from(await imageFile.arrayBuffer())
            const storedOriginal = await imageStore.readStoredFile(image.fsLocationOriginal).catch((error: unknown) => {
                // A missing original is exactly what replacing it repairs.
                if (error instanceof ServiceError && error.errorCode === 'NOT FOUND') return null
                throw error
            })
            if (storedOriginal?.equals(buffer)) return { replaced: false }

            // Checked before it is written, as uploadImage does.
            const ext = imageStore.storableExtension(buffer, allowedExtensions)
            const placeholderDataUrl = ext === 'svg' ? null : await placeholderDataUrlOf(buffer)

            const original = await imageStore.createFile(imageFile, allowedExtensions)
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
            }).catch(async (error: unknown) => {
                await destroyStoredFiles([original.fsLocation], 'a failed image file replacement')
                throw error
            })

            await destroyStoredFiles(storedFileLocationsOfImage(image), 'image file replacement')
            return { replaced: true }
        }
    }),

    /**
     * Produces the real avif variants for an already-uploaded image.
     * See createRasterVariants for which tiers get skipped.
     * Called by the background worker container (src/workers/definitions.ts), never directly from a request.
     */
    processImageVariants: defineSubOperation({
        paramsSchema: () => imageSchemas.params.processImageVariants,
        operation: () => async ({ prisma, params }) => {
            const image = await prisma.image.findUniqueOrThrow({ where: { id: params.imageId } })
            if (image.type !== 'RASTER') {
                throw new ServiceError('BAD PARAMETERS', `Image ${image.id} is an svg and has no variants to process`)
            }
            try {
                const buffer = await imageStore.readStoredFile(image.fsLocationOriginal)
                const variants = await createRasterVariants(buffer)
                const variantLocations = Object.values(variants)
                    .flatMap(variant => (variant ? [variant.fsLocation] : []))
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
                }).catch(async (error: unknown) => {
                    // The variants are written, but no row will point at them.
                    await destroyStoredFiles(variantLocations, 'a failed variant record')
                    throw error
                })
                return { success: true }
            } catch (error) {
                // The attempt was already counted when the worker claimed the image.
                await prisma.image.update({
                    where: { id: image.id },
                    data: { processingError: String(error) },
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
        paramsSchema: () => imageSchemas.params.retryImageProcessing,
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
        paramsSchema: () => imageSchemas.params.uploadManyImages,
        dataSchema: () => imageSchemas.data.uploadManyImages,
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
        paramsSchema: () => imageSchemas.params.readPageOfImagesInCollection,
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
        paramsSchema: () => imageSchemas.params.updateImageMeta,
        dataSchema: () => imageSchemas.data.updateImageMeta,
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
        paramsSchema: () => imageSchemas.params.destroyImageDbAndReturnCleanup,
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
        paramsSchema: () => imageSchemas.params.destroyImage,
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
        paramsSchema: () => imageSchemas.params.readCollectionOfImage,
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
