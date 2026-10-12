import '@pn-server-only'
import { cmsImageAuth } from './auth'
import { cmsImageParamsSchemas, cmsImageSchemas } from './schemas'
import { cmsImageIncluder } from './constants'
import { defineSubOperation } from '@/services/serviceOperation'
import { visibilityIncluder, toMatrix } from '@/services/visibility/implement'
import { ServiceError, Smorekopp } from '@/services/error'
import logger from '@/lib/logger'
import type { SpecialCmsImage } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** The collection an image is in, as the rule for linking the image wants it. */
async function readCollectionOfImage(prisma: PrismaPossibleTransaction<false>, imageId: number) {
    const image = await prisma.image.findUnique({
        where: { id: imageId },
        select: {
            collection: {
                select: {
                    special: true,
                    visibilityAdmin: { include: visibilityIncluder },
                    visibilityRegular: { include: visibilityIncluder },
                },
            },
        },
    })
    if (!image) throw new ServiceError('NOT FOUND', `Image with id ${imageId} does not exist`)

    return {
        special: image.collection.special,
        visibility: {
            adminLevel: toMatrix(image.collection.visibilityAdmin),
            regularLevel: toMatrix(image.collection.visibilityRegular),
        },
    }
}

const create = defineSubOperation({
    dataSchema: () => cmsImageSchemas.create,
    operation: (
        { special }: { special: SpecialCmsImage | null }
    ) => (
        { prisma, data: { imageId, ...data } }
    ) => prisma.cmsImage.create({
        data: {
            ...data,
            special,
            image: imageId !== undefined ? {
                connect: {
                    id: imageId
                }
            } : undefined
        },
        include: cmsImageIncluder,
    })
})

const generateSpecialCmsImageFromConfig = defineSubOperation({
    paramsSchema: () => cmsImageParamsSchemas.generateSpecialCmsImageFromConfig,
    operation: () => async ({ params }) => create.internalCall({
        data: {
            name: params.special,
        },
        operationImplementationFields: { special: params.special }
    })
})

export const cmsImageOperations = {
    create,
    generateSpecialCmsImageFromConfig,

    readSpecial: defineSubOperation({
        paramsSchema: () => cmsImageParamsSchemas.readSpecial,
        operation: () => async ({ prisma, params }) => {
            const image = await prisma.cmsImage.findUnique({
                where: {
                    special: params.special
                },
                include: cmsImageIncluder,
            })
            if (image) return image
            logger.error(`Could not find special cms image with special ${params.special} - creating it!`)
            return generateSpecialCmsImageFromConfig.internalCall({ params: { special: params.special } })
        }
    }),

    update: defineSubOperation({
        paramsSchema: () => cmsImageParamsSchemas.update,
        dataSchema: () => cmsImageSchemas.update,
        operation: () => async ({ prisma, params, session, bypassAuth, data: { imageId, ...data } }) => {
            // The implementing service authorizes editing the cms image itself, but not the image
            // being linked into it - that is the rule in cmsImageAuth.linkImage.
            if (imageId !== undefined && !bypassAuth) {
                const collection = await readCollectionOfImage(prisma, imageId)
                if (!cmsImageAuth.linkImage(collection).auth(session).authorized) {
                    throw new Smorekopp(
                        'UNAUTHORIZED',
                        'Du kan bare bruke bilder fra samlinger du administrerer'
                    )
                }
            }

            return prisma.cmsImage.update({
                where: {
                    id: params.cmsImageId,
                },
                data: {
                    ...data,
                    image: imageId !== undefined ? {
                        connect: {
                            id: imageId
                        }
                    } : undefined
                },
                include: cmsImageIncluder,
            })
        }
    }),

    destroy: defineSubOperation({
        paramsSchema: () => cmsImageParamsSchemas.destroy,
        operation: () => async ({ prisma, params }) => {
            const cmsImage = await prisma.cmsImage.findUniqueOrThrow({
                where: {
                    id: params.cmsImageId
                }
            })
            if (cmsImage.special) throw new ServiceError('BAD PARAMETERS', 'Cannot delete special CMS image')
            await prisma.cmsImage.delete({
                where: {
                    id: params.cmsImageId
                }
            })
        }
    }),

    /**
     * Check if a cms image with id is special with special atribute
     * in the provided special array
     * This is useful to do ownership checks for services using special cms images.
     */
    isSpecial: defineSubOperation({
        paramsSchema: () => cmsImageParamsSchemas.isSpecial,
        operation: () => async ({ prisma, params }) => {
            const image = await prisma.cmsImage.findUnique({
                where: {
                    id: params.cmsImageId,
                },
                select: {
                    special: true,
                }
            })
            if (!image) throw new ServiceError('NOT FOUND', 'Cms image not found')
            if (!image?.special) return false
            return params.special.includes(image.special)
        }
    })
} as const
