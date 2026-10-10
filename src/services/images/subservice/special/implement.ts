import '@pn-server-only'
import { defineOperation, defineSubOperation, type PrismaPossibleTransaction } from '@/services/serviceOperation'
import { imageOperations, expandImageCollection } from '@/services/images/subservice/operations'
import { expandedImageCollectionIncluder, type ImageExtension } from '@/services/images/subservice/constants'
import { imageSchemas } from '@/services/images/subservice/schemas'
import { ServiceError } from '@/services/error'
import logger from '@/lib/logger'
import { visibilityOperations } from '@/services/visibility/operations'
import type { SpecialCollection } from '@/prisma-generated-pn-types'
import type { ExpandedImageCollection } from '@/services/images/subservice/types'
import type { Authorizer } from '@/auth/authorizer/Authorizer'

export function implementSpecialCollection({
    special,
    imagePanelAuth,
    allowedExtensions,
    config
}: {
    special: SpecialCollection,
    imagePanelAuth: Authorizer
    /**
     * Which of the image system's extensions this collection accepts on upload.
     * Some special collection may only for example expect svg files, while others may only expect
     * raster images.
     */
    allowedExtensions: readonly ImageExtension[],
    config: {
        name: string,
        description: string,
    }
}) {
    /**
     * Special collections are not editable through the site, so an existing one is brought in line
     * with the config (name and description), while a missing one is created.
     */
    const generateCollectionFromConfig = defineSubOperation({
        operation: () => async ({ prisma }) => {
            const existing = await prisma.imageCollection.findUnique({
                where: { special },
                select: { id: true },
            })
            if (existing) {
                const updated = await prisma.imageCollection.update({
                    where: { special },
                    data: {
                        name: config.name,
                        description: config.description,
                    },
                    include: expandedImageCollectionIncluder,
                })
                return expandImageCollection(updated, null)
            }

            // Special collections don't use visibility for authorization. Instead, authorization is handled
            // by the owning service's panel authorizer (imagePanelAuth passed at construction). This is
            // because each special collection's access model is specific to its owning service.
            // Empty visibilities are required by the schema but unused; ownershipCheck in the dynamic system
            // prevents special collections from being accessed through the dynamic image operations.
            const visibilityRegular = await visibilityOperations.create.internalCall({})
            const visibilityAdmin = await visibilityOperations.create.internalCall({})

            const created = await prisma.imageCollection.create({
                data: {
                    special,
                    name: config.name,
                    description: config.description,
                    visibilityAdmin: {
                        connect: {
                            id: visibilityAdmin.id,
                        }
                    },
                    visibilityRegular: {
                        connect: {
                            id: visibilityRegular.id,
                        }
                    }
                },
                include: expandedImageCollectionIncluder,
            })
            return expandImageCollection(created, null)
        }
    })

    /**
     * The unauthorized read of the collection. Service-internal callers must use this rather than
     * `readCollection`: the panel authorizer guards the externally exposed operation only, and
     * running it on a nested call would demand panel-admin permission of every caller — blocking,
     * for instance, a member uploading their own profile picture.
     */
    const readCollectionInternal = async (
        { prisma }: { prisma: PrismaPossibleTransaction<false> }
    ): Promise<ExpandedImageCollection> => {
        const collection = await prisma.imageCollection.findUnique({
            where: {
                special,
            },
            include: expandedImageCollectionIncluder,
        })
        // Note: we do not pass the a standard image in here as calling
        // on the standard images service might cause an infinite loop,
        // as the standard collection is read to validate that the standard
        // image is in a correct state.
        if (collection) return expandImageCollection(collection, null)

        logger.error(`
            Special collection with special ${special} not found
            It must therefore be created from the config.
        `)

        return generateCollectionFromConfig.internalCall({ prisma })
    }

    const readCollection = defineOperation({
        authorizer: () => imagePanelAuth,
        operation: async ({ prisma }) => readCollectionInternal({ prisma })
    })

    const uploadImage = defineSubOperation({
        dataSchema: () => imageSchemas.uploadImage,
        operation: () => async ({ prisma, data }) =>
            imageOperations.uploadImage.internalCall({
                params: {
                    collectionId: (await readCollectionInternal({ prisma })).id,
                },
                data,
                operationImplementationFields: { uploadAsStandardImage: null, allowedExtensions }
            })
    })

    // Here one could just forward imageOperation.destroyImageDbAndReturnCleanup, as the internalOperations,
    // are not to be exposed to the client, and we may trust that the implementer service code
    // does not call this operation with imageIds it does not own interanally.
    // However, for sanity, and to catch any potential bugs, the subservice will
    // enforce ownership of imageId.
    const destroyImageDbAndReturnCleanup = defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }): Promise<() => Promise<void>> => {
            const collection = await readCollectionInternal({ prisma })
            const image = await prisma.image.findFirst({
                where: {
                    id: params.imageId,
                    collectionId: collection.id,
                },
                select: { id: true }
            })
            if (!image) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    `Image ${params.imageId} is not part of the special collection ${special}`
                )
            }
            return imageOperations.destroyImageDbAndReturnCleanup.internalCall({ params })
        }
    })

    const destroyImage = defineSubOperation({
        paramsSchema: () => imageSchemas.paramsSchemaImage,
        operation: () => async ({ prisma, params }) => {
            const collection = await readCollectionInternal({ prisma })
            const image = await prisma.image.findFirst({
                where: {
                    id: params.imageId,
                    collectionId: collection.id,
                },
                select: { id: true }
            })
            if (!image) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    `Image ${params.imageId} is not part of the special collection ${special}`
                )
            }
            return imageOperations.destroyImage.internalCall({ params })
        }
    })

    const readPageOfImagesInCollection = defineOperation({
        authorizer: () => imagePanelAuth,
        paramsSchema: imageSchemas.paramsSchemaReadPageOfImagesInSpecialCollection,
        operation: async ({ prisma, params }) => {
            const collection = await readCollectionInternal({ prisma })
            return imageOperations.readPageOfImagesInCollection.internalCall({
                params: {
                    paging: params.paging,
                    collectionId: collection.id,
                },
            })
        }
    })

    return {
        internalOperations: {
            uploadImage,
            destroyImageDbAndReturnCleanup,
            destroyImage,
        },
        specialCollectionPanelOperations: {
            readCollection,
            readPageOfImagesInCollection,
        },
        generateCollectionFromConfig,
    } as const
}
