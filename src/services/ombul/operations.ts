import '@pn-server-only'
import { ombulAuth } from './auth'
import { ombulSchemas } from './schemas'
import { ombulStore } from './store'
import { expandedOmbulIncluder, ombulOrderBy } from './constants'
import { ombulCoverImageOperations } from './ombulCoverCollection'
import { newOmbulNotificationChannel } from './newOmbulNotificationChannel'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { defineOperation } from '@/services/serviceOperation'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import type { Prisma } from '@/prisma-generated-pn-types'

export const ombulOperations = {
    read: defineOperation({
        authorizer: () => ombulAuth.read,
        paramsSchema: ombulSchemas.params.read,
        operation: ({ params, prisma }) =>
            prisma.ombul.findUniqueOrThrow({
                where: {
                    id: params.id,
                },
                include: expandedOmbulIncluder,
            })
    }),

    readAll: defineOperation({
        authorizer: () => ombulAuth.readAll,
        operation: ({ prisma }) =>
            prisma.ombul.findMany({
                orderBy: ombulOrderBy,
                include: expandedOmbulIncluder,
            })
    }),

    readLatest: defineOperation({
        authorizer: () => ombulAuth.readLatest,
        operation: ({ prisma }) => prisma.ombul.findFirst({ orderBy: ombulOrderBy })
    }),

    /**
     * The pdf is stored before the row is written, since the row refers to it. A pdf whose ombul
     * is never committed is an orphan, which the store destroys. The notification waits until the
     * ombul is committed, so nobody is told about an ombul that was rolled back.
     */
    create: defineOperation({
        authorizer: () => ombulAuth.create,
        dataSchema: ombulSchemas.data.create,
        transaction: 'OPENS',
        operation: async ({ data, prisma }) => {
            const { ombulCoverImage, ombulFile, year, issueNumber, ...rest } = data

            const file = await ombulStore.createFile(ombulFile)
            const ombul = await prisma.$transaction(async tx => {
                const coverImage = await ombulCoverImageOperations.uploadImage.internalCall({
                    prisma: tx,
                    data: {
                        imageFile: ombulCoverImage,
                        imageAlt: `Forsiden til ${rest.name}`,
                    }
                })

                // The paragraph is always created empty - it is filled in afterwards through
                // ombulOperations.updateParagraphContent.
                const paragraph = await cmsParagraphOperations.create.internalCall({
                    prisma: tx,
                    data: {},
                    operationImplementationFields: { special: null }
                })

                return tx.ombul.create({
                    data: {
                        ...rest,
                        year,
                        issueNumber: issueNumber || await nextIssueNumber(tx, year),
                        coverImage: {
                            connect: {
                                id: coverImage.id
                            }
                        },
                        paragraph: {
                            connect: {
                                id: paragraph.id
                            }
                        },
                        file: {
                            connect: {
                                name: file.name
                            }
                        },
                    }
                })
            })

            await newOmbulNotificationChannel.internalOperations.createNotification.internalCall({
                data: {
                    title: 'Ny ombul',
                    message: `Ny ombul er ute! ${ombul.name}`,
                    url: omegaLinks.ombul(ombul),
                    audience: { permission: 'OMBUL_USE' },
                },
            })

            return ombul
        }
    }),

    update: defineOperation({
        authorizer: () => ombulAuth.update,
        dataSchema: ombulSchemas.data.update,
        paramsSchema: ombulSchemas.params.update,
        operation: ({ data, prisma, params }) =>
            prisma.ombul.update({
                where: {
                    id: params.id
                },
                data,
                include: expandedOmbulIncluder,
            })
    }),

    /** The old pdf is an orphan once the row refers to the new one, which the store destroys. */
    updateFile: defineOperation({
        authorizer: () => ombulAuth.updateFile,
        dataSchema: ombulSchemas.data.updateFile,
        paramsSchema: ombulSchemas.params.updateFile,
        operation: async ({ data, prisma, params }) => {
            const file = await ombulStore.createFile(data.ombulFile)
            return prisma.ombul.update({
                where: {
                    id: params.id
                },
                data: {
                    fsLocation: file.name
                },
                include: expandedOmbulIncluder,
            })
        }
    }),

    updateCoverImage: defineOperation({
        authorizer: () => ombulAuth.updateCoverImage,
        paramsSchema: ombulSchemas.params.updateCoverImage,
        dataSchema: ombulSchemas.data.updateCoverImage,
        transaction: 'OPENS',
        operation: async ({ prisma, params, data }) => {
            const newImage = await prisma.$transaction(async tx => {
                const existingOmbul = await tx.ombul.findUniqueOrThrow({
                    where: { id: params.ombulId },
                })

                const uploadedImage =
                    await ombulCoverImageOperations.uploadImage.internalCall({ prisma: tx, data })

                await tx.ombul.update({
                    where: { id: existingOmbul.id },
                    data: {
                        coverImage: {
                            connect: { id: uploadedImage.id }
                        }
                    }
                })

                await ombulCoverImageOperations.destroyImage.internalCall({
                    prisma: tx,
                    params: { imageId: existingOmbul.coverImageId }
                })

                return uploadedImage
            })
            return newImage
        }
    }),

    updateParagraphContent: cmsParagraphOperations.updateContent.implement({
        implementationParamsSchema: ombulSchemas.params.updateParagraphContent,
        authorizer: () => ombulAuth.updateParagraphContent,
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.ombul.findUniqueOrThrow({
                where: { id: implementationParams.ombulId },
                select: { paragraphId: true },
            })).paragraphId === params.paragraphId
    }),

    /**
     * Everything the ombul owns goes in one transaction. The pdf and the cover image's files are
     * orphans once it has committed, which the store destroys.
     */
    destroy: defineOperation({
        authorizer: () => ombulAuth.destroy,
        paramsSchema: ombulSchemas.params.destroy,
        transaction: 'OPENS',
        operation: async ({ params, prisma }) => {
            const ombul = await prisma.$transaction(async tx => {
                const deleted = await tx.ombul.delete({
                    where: {
                        id: params.id
                    }
                })
                await ombulCoverImageOperations.destroyImage.internalCall({
                    prisma: tx,
                    params: { imageId: deleted.coverImageId }
                })
                await cmsParagraphOperations.destroy.internalCall({
                    prisma: tx,
                    params: { paragraphId: deleted.paragraphId }
                })
                return deleted
            })

            return ombul
        }
    }),
} as const

/** Issue numbers count up within a year, so the next one is one past the highest already written. */
async function nextIssueNumber(prisma: Prisma.TransactionClient, year: number): Promise<number> {
    const latest = await prisma.ombul.findFirst({
        where: { year },
        orderBy: { issueNumber: 'desc' },
        select: { issueNumber: true },
    })
    return latest ? latest.issueNumber + 1 : 1
}
