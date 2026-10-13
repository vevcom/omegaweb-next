import '@pn-server-only'
import { flairAuth } from './auth'
import { flairSchemas } from './schemas'
import { flairImageOperations } from './flairImageCollection'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { takeAdvisoryLock } from '@/lib/advisoryLocks'
import type { Prisma } from '@/prisma-generated-pn-types'

export const flairOperations = {
    create: defineOperation({
        authorizer: () => flairAuth.create,
        dataSchema: flairSchemas.data.create,
        opensTransaction: true,
        operation: ({ prisma, data }) =>
            prisma.$transaction(async tx => {
                const image = await flairImageOperations.uploadImage.internalCall({ prisma: tx, data })
                await lockRanks(tx)
                const { _max: { rank: lastRank } } = await tx.flair.aggregate({ _max: { rank: true } })
                return await tx.flair.create({
                    data: {
                        name: data.name,
                        rank: (lastRank ?? 0) + 1,
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
        dataSchema: flairSchemas.data.update,
        paramsSchema: flairSchemas.params.update,
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
        paramsSchema: flairSchemas.params.updateImage,
        dataSchema: flairSchemas.data.updateImage,
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
        paramsSchema: flairSchemas.params.read,
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
        operation: async ({ prisma }) => await prisma.flair.findMany({
            include: {
                image: { include: expandedImageIncluder }
            },
            orderBy: { rank: 'asc' }
        })
    }),
    readUserFlairs: defineOperation({
        authorizer: ({ params }) => flairAuth.readUserFlairs.data({ userId: params.userId }),
        paramsSchema: flairSchemas.params.readUserFlairs,
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
        paramsSchema: flairSchemas.params.assignToUser,
        operation: async ({ prisma, params }) =>
            await prisma.flair.update({
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
            }),
    }),
    unAssignToUser: defineOperation({
        authorizer: () => flairAuth.unAssignToUser,
        paramsSchema: flairSchemas.params.unAssignToUser,
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
            }),
    }),
    destroy: defineOperation({
        authorizer: () => flairAuth.destroy,
        paramsSchema: flairSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params: { flairId } }) => {
            const { cleanup } = await prisma.$transaction(async tx => {
                await lockRanks(tx)
                const flair = await tx.flair.delete({
                    where: {
                        id: flairId,
                    }
                })
                // The flairs below move up one step to close the gap. One at a time, from the top: each
                // move frees the rank the next one moves into, which keeps the unique rank satisfied.
                const flairsBelow = await tx.flair.findMany({
                    where: { rank: { gt: flair.rank } },
                    orderBy: { rank: 'asc' },
                    select: { id: true, rank: true },
                })
                await flairsBelow.reduce((previousMove, flairBelow) => previousMove.then(async () => {
                    await tx.flair.update({ where: { id: flairBelow.id }, data: { rank: flairBelow.rank - 1 } })
                }), Promise.resolve())
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
    /** Moves a flair one step towards rank 1, the flair shown first. */
    increaseRank: defineOperation({
        authorizer: () => flairAuth.increaseRank,
        paramsSchema: flairSchemas.params.increaseRank,
        opensTransaction: true,
        operation: async ({ prisma, params: { flairId } }) =>
            prisma.$transaction(tx => moveRank(tx, flairId, 'UP')),
    }),
    /** Moves a flair one step away from rank 1. */
    decreaseRank: defineOperation({
        authorizer: () => flairAuth.decreaseRank,
        paramsSchema: flairSchemas.params.decreaseRank,
        opensTransaction: true,
        operation: async ({ prisma, params: { flairId } }) =>
            prisma.$transaction(tx => moveRank(tx, flairId, 'DOWN')),
    }),
} as const

/**
 * Flairs are ordered by rank, and rank 1 is shown first. Every operation that changes ranks takes
 * this lock, which keeps the ranks 1, 2, 3, ... with no gaps and no two moves crossing.
 */
async function lockRanks(tx: Prisma.TransactionClient) {
    await takeAdvisoryLock(tx, 'flairRanks')
}

/**
 * Swaps the rank of a flair with its neighbour: towards rank 1 for 'UP', away from it for 'DOWN'.
 * Rank 0 is never a real rank, so it holds one of them while the two trade places.
 */
async function moveRank(prisma: Prisma.TransactionClient, flairId: number, direction: 'UP' | 'DOWN') {
    await lockRanks(prisma)
    const flair = await prisma.flair.findUniqueOrThrow({
        where: { id: flairId }
    })
    const neighbour = await prisma.flair.findFirst({
        where: {
            rank: direction === 'UP' ? { lt: flair.rank } : { gt: flair.rank },
        },
        orderBy: {
            rank: direction === 'UP' ? 'desc' : 'asc',
        },
    })
    if (!neighbour) {
        throw new ServiceError(
            'BAD PARAMETERS',
            direction === 'UP' ? 'Flairen er allerede øverst.' : 'Flairen er allerede nederst.'
        )
    }

    await prisma.flair.update({ where: { id: neighbour.id }, data: { rank: 0 } })
    await prisma.flair.update({ where: { id: flair.id }, data: { rank: neighbour.rank } })
    await prisma.flair.update({ where: { id: neighbour.id }, data: { rank: flair.rank } })
}
