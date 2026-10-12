import '@pn-server-only'
import { promoAuth } from './auth'
import { promoSchema } from './schemas'
import { promoImageOperations } from './promoImageCollection'
import { promoWithImageIncluder } from './constants'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'

export const promoOperations = {
    create: defineOperation({
        authorizer: () => promoAuth.create,
        dataSchema: promoSchema.create,
        opensTransaction: true,
        operation: ({ prisma, data }) =>
            prisma.$transaction(async tx => {
                const image = await promoImageOperations.uploadImage.internalCall({ prisma: tx, data })
                return await tx.promo.create({
                    data: {
                        title: data.title,
                        text: data.text,
                        link: data.link,
                        startDate: data.startDate,
                        endDate: data.endDate,
                        image: {
                            connect: {
                                id: image.id
                            }
                        }
                    },
                    include: promoWithImageIncluder,
                })
            })
    }),
    update: defineOperation({
        authorizer: () => promoAuth.update,
        paramsSchema: z.object({
            promoId: z.number()
        }),
        dataSchema: promoSchema.update,
        operation: ({ prisma, params, data }) =>
            prisma.promo.update({
                where: {
                    id: params.promoId,
                },
                data: {
                    title: data.title,
                    text: data.text,
                    link: data.link,
                    startDate: data.startDate,
                    endDate: data.endDate,
                }
            })
    }),
    updateImage: defineOperation({
        authorizer: () => promoAuth.updateImage,
        paramsSchema: z.object({
            promoId: z.number()
        }),
        dataSchema: promoSchema.updateImage,
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            const { image: newImage, cleanup } = await prisma.$transaction(async tx => {
                const existingPromo = await tx.promo.findUniqueOrThrow({
                    where: { id: params.promoId }
                })
                const uploadedImage =
                    await promoImageOperations.uploadImage.internalCall({ prisma: tx, data })
                await tx.promo.update({
                    where: { id: existingPromo.id },
                    data: {
                        image: {
                            connect: {
                                id: uploadedImage.id
                            }
                        }
                    }
                })
                const fileCleanup = await promoImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                    prisma: tx,
                    params: { imageId: existingPromo.imageId }
                })
                return { image: uploadedImage, cleanup: fileCleanup }
            }, { timeout: 20000 })
            await cleanup()
            return newImage
        }
    }),
    read: defineOperation({
        authorizer: () => promoAuth.read,
        paramsSchema: z.object({
            promoId: z.number(),
        }),
        operation: async ({ prisma, params: { promoId } }) =>
            await prisma.promo.findUniqueOrThrow({
                where: {
                    id: promoId,
                },
                include: promoWithImageIncluder,
            })
    }),
    readAll: defineOperation({
        authorizer: () => promoAuth.readAll,
        operation: async ({ prisma }) =>
            await prisma.promo.findMany({
                include: promoWithImageIncluder,
                orderBy: { startDate: 'desc' },
            })
    }),
    // The banner currently live on the frontpage: whichever promo's period covers now, preferring
    // the most recently created one if several periods overlap.
    readActive: defineOperation({
        authorizer: () => promoAuth.readActive,
        operation: async ({ prisma }) => {
            const now = new Date()
            return await prisma.promo.findFirst({
                where: {
                    startDate: { lte: now },
                    endDate: { gte: now },
                },
                include: promoWithImageIncluder,
                orderBy: { createdAt: 'desc' },
            })
        }
    }),
    destroy: defineOperation({
        authorizer: () => promoAuth.destroy,
        paramsSchema: z.object({
            promoId: z.number(),
        }),
        opensTransaction: true,
        operation: async ({ prisma, params: { promoId } }) => {
            const { cleanup } = await prisma.$transaction(async tx => {
                const promo = await tx.promo.delete({
                    where: {
                        id: promoId,
                    }
                })
                const fileCleanup =
                    await promoImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: {
                            imageId: promo.imageId,
                        }
                    })
                return { cleanup: fileCleanup }
            })
            // Clean up files after transaction succeeds
            await cleanup()
        }
    }),
} as const
