import '@pn-server-only'
import { cmsImageSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { visibilityIncluder, toMatrix } from '@/services/visibility/implement'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { specialImagePanels } from '@/services/images/specialPanels/constants'
import { ServiceError, Smorekopp } from '@/services/error'
import { SpecialCmsImage } from '@/prisma-generated-pn-types'
import logger from '@/lib/logger'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { z } from 'zod'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { SessionMaybeUser } from '@/auth/session/Session'

/**
 * Checks whether the session administrates the collection an image belongs to.
 *
 * The two kinds of collection answer this question differently:
 * - a dynamic collection is administrated by the sessions fulfilling its admin visibility level
 *   (or by anyone holding IMAGE_ADMIN, the same bypass the dynamic image auth uses)
 * - a special collection has no meaningful visibility levels - it is administrated by the sessions
 *   passing the panel auth of the service owning it
 */
async function sessionAdministratesCollectionOfImage({
    prisma,
    session,
    imageId,
}: {
    prisma: PrismaPossibleTransaction<false>,
    session: SessionMaybeUser,
    imageId: number,
}): Promise<boolean> {
    const image = await prisma.image.findUnique({
        where: {
            id: imageId,
        },
        select: {
            collection: {
                select: {
                    special: true,
                    visibilityAdmin: {
                        include: visibilityIncluder,
                    },
                },
            },
        },
    })
    if (!image) throw new ServiceError('NOT FOUND', `Image with id ${imageId} does not exist`)

    const { special, visibilityAdmin } = image.collection

    if (special) {
        return specialImagePanels[special].auth.auth(session).authorized
    }

    return checkVisibility(session.memberships, toMatrix(visibilityAdmin))
        || session.permissions.includes('IMAGE_ADMIN')
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
        include: {
            image: { include: expandedImageIncluder }
        }
    })
})

const generateSpecialCmsImageFromConfig = defineSubOperation({
    paramsSchema: () => z.object({
        special: z.nativeEnum(SpecialCmsImage)
    }),
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
        paramsSchema: () => z.object({
            special: z.nativeEnum(SpecialCmsImage)
        }),
        operation: () => async ({ prisma, params }) => {
            const image = await prisma.cmsImage.findUnique({
                where: {
                    special: params.special
                },
                include: {
                    image: { include: expandedImageIncluder }
                }
            })
            if (image) return image
            logger.error(`Could not find special cms image with special ${params.special} - creating it!`)
            return generateSpecialCmsImageFromConfig.internalCall({ params: { special: params.special } })
        }
    }),

    update: defineSubOperation({
        paramsSchema: () => z.object({
            cmsImageId: z.number()
        }),
        dataSchema: () => cmsImageSchemas.update,
        operation: () => async ({ prisma, params, session, bypassAuth, data: { imageId, ...data } }) => {
            // The implementing service authorizes editing the cms image itself, but not the image
            // being linked into it - a session may only point a cms image at an image from a
            // collection it administrates.
            if (imageId !== undefined && !bypassAuth) {
                const administrates = await sessionAdministratesCollectionOfImage({
                    prisma,
                    session,
                    imageId,
                })
                if (!administrates) {
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
                include: {
                    image: { include: expandedImageIncluder }
                }
            })
        }
    }),

    destroy: defineSubOperation({
        paramsSchema: () => z.object({
            cmsImageId: z.number()
        }),
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
        paramsSchema: () => z.object({
            cmsImageId: z.number(),
            special: z.array(z.nativeEnum(SpecialCmsImage))
        }),
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
