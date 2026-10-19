import '@pn-server-only'
import { ombulAuth } from './auth'
import { ombulSchemas } from './schemas'
import { ombulStore } from './store'
import { expandedOmbulIncluder, ombulOrderBy } from './constants'
import { ombulCoverImageOperations } from './ombulCoverCollection'
import { defineOperation } from '@/services/serviceOperation'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { notificationOperations } from '@/services/notifications/operations'
import logger from '@/lib/logger'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { File } from 'node:buffer'

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
     * The pdf is stored before the row is written, since the row needs its location, and removed
     * again if the transaction fails. The notification waits until the ombul is committed, so
     * nobody is told about an ombul that was rolled back.
     */
    create: defineOperation({
        authorizer: () => ombulAuth.create,
        dataSchema: ombulSchemas.data.create,
        opensTransaction: true,
        operation: async ({ data, prisma }) => {
            const { ombulCoverImage, ombulFile, year, issueNumber, ...rest } = data

            const ombul = await withStoredOmbulFile(ombulFile, fsLocation => prisma.$transaction(async tx => {
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
                        fsLocation,
                    }
                })
            }))

            await notificationOperations.createSpecial.internalCall({
                params: {
                    special: 'NEW_OMBUL',
                },
                data: {
                    title: 'Ny ombul',
                    message: `Ny ombul er ute! ${ombul.name}`,
                    url: `/ombul/${ombul.year}/${formatVevenUri(ombul.name, ombul.id)}`,
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

    /**
     * The old pdf is only removed once the row points at the new one, so a failure anywhere
     * before that leaves the ombul as it was.
     */
    updateFile: defineOperation({
        authorizer: () => ombulAuth.updateFile,
        dataSchema: ombulSchemas.data.updateFile,
        paramsSchema: ombulSchemas.params.updateFile,
        operation: async ({ data, prisma, params }) => {
            const { fsLocation: oldFsLocation } = await prisma.ombul.findUniqueOrThrow({
                where: {
                    id: params.id
                },
                select: { fsLocation: true },
            })

            const ombul = await withStoredOmbulFile(data.ombulFile, fsLocation => prisma.ombul.update({
                where: {
                    id: params.id
                },
                data: {
                    fsLocation
                },
                include: expandedOmbulIncluder,
            }))

            await destroyStoredOmbulFile(oldFsLocation, 'ombul file replacement')
            return ombul
        }
    }),

    updateCoverImage: defineOperation({
        authorizer: () => ombulAuth.updateCoverImage,
        paramsSchema: ombulSchemas.params.updateCoverImage,
        dataSchema: ombulSchemas.data.updateCoverImage,
        opensTransaction: true,
        operation: async ({ prisma, params, data }) => {
            const { image: newImage, cleanup } = await prisma.$transaction(async tx => {
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

                const fileCleanup =
                    await ombulCoverImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: { imageId: existingOmbul.coverImageId }
                    })

                return { image: uploadedImage, cleanup: fileCleanup }
            })
            await cleanup()
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
     * Everything the ombul owns goes in one transaction. Only the files - the pdf and the cover
     * image's - wait until it has committed, since a file cannot be rolled back.
     */
    destroy: defineOperation({
        authorizer: () => ombulAuth.destroy,
        paramsSchema: ombulSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ params, prisma }) => {
            const { ombul, cleanupCoverImage } = await prisma.$transaction(async tx => {
                const deleted = await tx.ombul.delete({
                    where: {
                        id: params.id
                    }
                })
                const coverImageCleanup =
                    await ombulCoverImageOperations.destroyImageDbAndReturnCleanup.internalCall({
                        prisma: tx,
                        params: { imageId: deleted.coverImageId }
                    })
                await cmsParagraphOperations.destroy.internalCall({
                    prisma: tx,
                    params: { paragraphId: deleted.paragraphId }
                })
                return { ombul: deleted, cleanupCoverImage: coverImageCleanup }
            })
            await cleanupCoverImage()
            await destroyStoredOmbulFile(ombul.fsLocation, 'ombul deletion')

            return ombul
        }
    }),
} as const

/**
 * Stores the pdf, then runs `write` with its location. A file cannot be rolled back, so the pdf is
 * removed again if the write fails - that is what keeps a failed write from leaving a file no row
 * points at.
 */
async function withStoredOmbulFile<Result>(
    ombulFile: File,
    write: (fsLocation: string) => Promise<Result>,
): Promise<Result> {
    const { fsLocation } = await ombulStore.createFile(ombulFile, ['pdf'])
    try {
        return await write(fsLocation)
    } catch (error) {
        await destroyStoredOmbulFile(fsLocation, 'a failed ombul write')
        throw error
    }
}

/**
 * Best-effort removal of a pdf whose row is already gone. A missing file is the state we want, and
 * a failure here must not fail the request the row was already removed for, so it is logged rather
 * than thrown.
 */
async function destroyStoredOmbulFile(fsLocation: string, context: string): Promise<void> {
    await ombulStore.destroyFile(fsLocation, undefined, false).catch(error => {
        logger.error(`Failed to clean up ombul file ${fsLocation} after ${context}`, { error })
    })
}

/** Issue numbers count up within a year, so the next one is one past the highest already written. */
async function nextIssueNumber(prisma: Prisma.TransactionClient, year: number): Promise<number> {
    const latest = await prisma.ombul.findFirst({
        where: { year },
        orderBy: { issueNumber: 'desc' },
        select: { issueNumber: true },
    })
    return latest ? latest.issueNumber + 1 : 1
}
