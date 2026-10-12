import '@pn-server-only'
import { flairAuth } from './auth'
import { flairSchema } from './schemas'
import { flairImageOperations } from './flairImageCollection'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { z } from 'zod'

export const flairOperations = {
    create: defineOperation({
        authorizer: () => flairAuth.create,
        dataSchema: flairSchema.create,
        opensTransaction: true,
        operation: ({ prisma, data }) =>
            prisma.$transaction(async tx => {
                const image = await flairImageOperations.uploadImage.internalCall({ prisma: tx, data })
                return await tx.flair.create({
                    data: {
                        name: data.name,
                        colorR: data.color.red,
                        colorG: data.color.green,
                        colorB: data.color.blue,
                        image: {
                            connect: {
                                id: image.id
                            }
                        }
                    }
                })
            })
    }),
    update: defineOperation({
        authorizer: () => flairAuth.update,
        dataSchema: flairSchema.update,
        paramsSchema: z.object({
            flairId: z.number()
        }),
        operation: ({ prisma, params, data }) =>
            prisma.flair.update({
                where: {
                    id: params.flairId,
                },
                data: {
                    name: data.name,
                    colorR: data.color?.red,
                    colorG: data.color?.green,
                    colorB: data.color?.blue,
                }
            })
    }),
    updateImage: defineOperation({
        authorizer: () => flairAuth.updateImage,
        paramsSchema: z.object({
            flairId: z.number()
        }),
        dataSchema: flairSchema.updateImage,
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            const { image: newImage, cleanup } = await prisma.$transaction(async tx => {
                const existingFlair = await tx.flair.findUniqueOrThrow({
                    where: { id: params.flairId }
                })
                const uploadedImage =
                    await flairImageOperations.uploadImage.internalCall({ prisma: tx, data })
                await tx.flair.update({
                    where: { id: existingFlair.id },
                    data: {
                        image: {
                            connect: {
                                id: uploadedImage.id
                            }
                        }
                    }
                })
                const fileCleanup = existingFlair.imageId
                    ? await flairImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: { imageId: existingFlair.imageId }
                    })
                    : async () => {}
                return { image: uploadedImage, cleanup: fileCleanup }
            }, { timeout: 20000 })
            await cleanup()
            return newImage
        }
    }),
    read: defineOperation({
        authorizer: () => flairAuth.read,
        paramsSchema: z.object({
            flairId: z.number(),
        }),
        operation: async ({ prisma, params: { flairId } }) =>
            await prisma.flair.findUniqueOrThrow({
                where: {
                    id: flairId,
                },
                include: {
                    image: { include: expandedImageIncluder }
                }
            })
    }),
    readAll: defineOperation({
        authorizer: () => flairAuth.readAll,
        operation: async ({ prisma }) => {
            const flairs = (await prisma.flair.findMany({
                include: {
                    image: { include: expandedImageIncluder }
                }
            })).sort((a, b) => a.rank - b.rank || a.id - b.id)
            // Assign new ranks: 1, 2, 3, ... so there are no gaps
            for (let i = 0; i < flairs.length; i++) {
                const newRank = i + 1
                if (flairs[i].rank !== newRank) {
                    await prisma.flair.update({
                        where: { id: flairs[i].id },
                        data: { rank: newRank }
                    })
                }
            }
            const normalizedFlairs = await prisma.flair.findMany({
                include: {
                    image: { include: expandedImageIncluder }
                },
                orderBy: { rank: 'asc' }
            })
            return normalizedFlairs
        }
    }),
    readUserFlairs: defineOperation({
        authorizer: ({ params }) => flairAuth.readUserFlairs.data({ userId: params.userId }),
        paramsSchema: z.object({
            userId: z.number(),
        }),
        operation: async ({ prisma, params: { userId } }) =>
            await prisma.user.findUniqueOrThrow({
                where: {
                    id: userId,
                },
                select: {
                    flairs: {
                        include: {
                            image: { include: expandedImageIncluder }
                        }
                    },
                }
            }).then(user => user.flairs)
    }),
    assignToUser: defineOperation({
        authorizer: () => flairAuth.assignToUser,
        paramsSchema: z.object({
            flairId: z.number(),
            userId: z.number(),
        }),
        operation: async ({ prisma, params }) => {
            const flair = await prisma.flair.findUnique({
                where: { id: params.flairId }
            })
            if (!flair) {
                throw new Error(`Flair with id ${params.flairId} not found`)
            }


            return await prisma.flair.update({
                where: {
                    id: params.flairId,
                },
                data: {
                    user: {
                        connect: {
                            id: params.userId
                        }
                    }
                }
            })
        }
        ,
    }),
    unAssignToUser: defineOperation({
        authorizer: () => flairAuth.unAssignToUser,
        paramsSchema: z.object({
            flairId: z.number(),
            userId: z.number(),
        }),
        operation: async ({ prisma, params }) =>
            await prisma.flair.update({
                where: {
                    id: params.flairId,
                },
                data: {
                    user: {
                        disconnect: {
                            id: params.userId
                        }
                    }
                }
            })
        ,
    }),
    destroy: defineOperation({
        authorizer: () => flairAuth.destroy,
        paramsSchema: z.object({
            flairId: z.number(),
        }),
        opensTransaction: true,
        operation: async ({ prisma, params: { flairId } }) => {
            const { cleanup } = await prisma.$transaction(async tx => {
                const flair = await tx.flair.delete({
                    where: {
                        id: flairId,
                    }
                })
                const fileCleanup =
                    await flairImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: {
                            imageId: flair.imageId,
                        }
                    })
                return { cleanup: fileCleanup }
            })
            // Clean up files after transaction succeeds
            await cleanup()
        }
    }),
    increaseRank: defineOperation({
        authorizer: () => flairAuth.increaseRank,
        paramsSchema: z.object({
            flairId: z.number(),
        }),
        operation: async ({ prisma, params: { flairId } }) => {
            const flair = await prisma.flair.findUniqueOrThrow({
                where: { id: flairId }
            })
            const lowerFlair = await prisma.flair.findFirst({
                where: {
                    rank: {
                        lt: flair.rank
                    }
                },
                orderBy: {
                    rank: 'desc'
                }
            })
            if (!lowerFlair) {
                throw new ServiceError('BAD PARAMETERS', 'Flair is already at lowest rank')
            }
            const tempRank = -99999999
            await prisma.flair.update({
                where: { id: lowerFlair.id },
                data: { rank: tempRank }
            })
            await prisma.flair.update({
                where: { id: flair.id },
                data: { rank: lowerFlair.rank }
            })
            await prisma.flair.update({
                where: { id: lowerFlair.id },
                data: { rank: flair.rank }
            })
        }
    }),
    decreaseRank: defineOperation({
        authorizer: () => flairAuth.decreaseRank,
        paramsSchema: z.object({
            flairId: z.number(),
        }),
        operation: async ({ prisma, params: { flairId } }) => {
            const flair = await prisma.flair.findUniqueOrThrow({
                where: { id: flairId }
            })
            const higherFlair = await prisma.flair.findFirst({
                where: {
                    rank: {
                        gt: flair.rank
                    }
                },
                orderBy: {
                    rank: 'asc'
                }
            })
            if (!higherFlair) {
                throw new ServiceError('BAD PARAMETERS', 'Flair is already at highest rank')
            }
            // Use a temporary rank to avoid unique constraint violation
            const tempRank = -99999999
            await prisma.flair.update({
                where: { id: higherFlair.id },
                data: { rank: tempRank }
            })
            await prisma.flair.update({
                where: { id: flair.id },
                data: { rank: higherFlair.rank }
            })
            await prisma.flair.update({
                where: { id: higherFlair.id },
                data: { rank: flair.rank }
            })
        }
    }),
} as const
