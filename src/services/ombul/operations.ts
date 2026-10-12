import '@pn-server-only'
import { ombulAuth } from './auth'
import { ombulSchemas } from './schemas'
import { ombulCoverImageOperations } from './ombulCoverCollection'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { implementStore } from '@/lib/store/implementStore'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { notificationOperations } from '@/services/notifications/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { z } from 'zod'

export const ombulStore = implementStore({
    staticStorePrefix: 'ombul',
    allowedExtentions: ['pdf'],
})

const read = defineOperation({
    authorizer: () => ombulAuth.read,
    paramsSchema: z.union([
        z.object({
            id: z.number(),
            name: z.undefined().optional(),
            year: z.undefined().optional()
        }),
        z.object({
            id: z.undefined().optional(),
            name: z.string(),
            year: z.number()
        })
    ]),
    operation: ({ params, prisma }) =>
        prisma.ombul.findUniqueOrThrow({
            where: typeof params.id === 'number' ? {
                id: params.id
            } : {
                year_name: {
                    name: params.name,
                    year: params.year
                }
            },
            include: {
                coverImage: { include: expandedImageIncluder },
                paragraph: true,
            }
        })
})

const readAll = defineOperation({
    authorizer: () => ombulAuth.readAll,
    operation: ({ prisma }) =>
        prisma.ombul.findMany({
            orderBy: [
                { year: 'desc' },
                { issueNumber: 'desc' },
            ],
            include: {
                coverImage: { include: expandedImageIncluder },
                paragraph: true,
            }
        })
})

const readLatest = defineOperation({
    authorizer: () => ombulAuth.readLatest,
    operation: async ({ prisma }) => {
        const ombul = await prisma.ombul.findMany({
            orderBy: [
                { year: 'desc' },
                { issueNumber: 'desc' },
            ],
            take: 1,
        })
        return ombul[0]
    }
})

const updateCoverImage = defineOperation({
    authorizer: () => ombulAuth.updateCoverImage,
    paramsSchema: z.object({
        ombulId: z.number()
    }),
    dataSchema: ombulSchemas.updateCoverImage,
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
        },)
        await cleanup()
        return newImage
    }
})

/**
 * A function to destroy an ombul, also deletes the file from the store, and the cover image
 * @param id - The id of the ombul to destroy
 * @returns
 */
const destroy = defineOperation({
    authorizer: () => ombulAuth.destroy,
    paramsSchema: z.object({
        id: z.number()
    }),
    operation: async ({ params, prisma }) => {
        const ombul = await prisma.ombul.findUnique({
            where: {
                id: params.id
            }
        })
        if (!ombul) throw new ServiceError('NOT FOUND', 'Ombul ikke funnet.')

        await ombulStore.destroyFile(ombul.fsLocation)

        await prisma.ombul.delete({
            where: {
                id: params.id
            }
        })

        await ombulCoverImageOperations.destroyImage.internalCall({
            params: { imageId: ombul.coverImageId }
        })
        await cmsParagraphOperations.destroy.internalCall({
            params: { paragraphId: ombul.paragraphId }
        })

        return ombul
    }
})

const create = defineOperation({
    authorizer: () => ombulAuth.create,
    dataSchema: ombulSchemas.create,
    opensTransaction: true,
    operation: ({ data, prisma }) =>
        prisma.$transaction(async tx => {
            // Get the latest issue number if not provided
            const { ombulCoverImage, ombulFile, year, issueNumber: givenIssueNumber, ...restOfConf } = data

            let latestIssueNumber = 1
            if (!givenIssueNumber) {
                const ombul = await tx.ombul.findFirst({
                    where: {
                        year
                    },
                    orderBy: {
                        issueNumber: 'desc'
                    }
                })
                if (ombul) {
                    latestIssueNumber = ombul.issueNumber + 1
                }
            }
            const issueNumber = givenIssueNumber || latestIssueNumber

            const { fsLocation } = await ombulStore.createFile(ombulFile, ['pdf'])

            const coverImage = await ombulCoverImageOperations.uploadImage.internalCall({
                prisma: tx,
                data: {
                    imageFile: ombulCoverImage,
                    imageAlt: `Forsiden til ${restOfConf.name}`,
                }
            })

            // The paragraph is always created empty - it is filled in afterwards through
            // ombulOperations.updateParagraphContent.
            const paragraph = await cmsParagraphOperations.create.internalCall({
                prisma: tx,
                data: {},
                operationImplementationFields: { special: null }
            })

            const ombul = await tx.ombul.create({
                data: {
                    ...restOfConf,
                    year,
                    issueNumber,
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

            notificationOperations.createSpecial.internalCall({
                params: {
                    special: 'NEW_OMBUL',
                },
                data: {
                    title: 'Ny ombul',
                    message: `Ny ombul er ute! ${ombul.name}`,
                    audience: { permission: 'OMBUL_USE' },
                },
            })

            return ombul
        })
})

const update = defineOperation({
    authorizer: () => ombulAuth.update,
    dataSchema: ombulSchemas.update,
    paramsSchema: z.object({
        id: z.number()
    }),
    operation: ({ data, prisma, params }) =>
        prisma.ombul.update({
            where: {
                id: params.id
            },
            data,
            include: {
                coverImage: { include: expandedImageIncluder },
                paragraph: true,
            }
        })
})

const updateFile = defineOperation({
    authorizer: () => ombulAuth.updateFile,
    dataSchema: ombulSchemas.updateFile,
    paramsSchema: z.object({
        id: z.number()
    }),
    operation: async ({ data, prisma, params }) => {
        const { fsLocation } = await ombulStore.createFile(data.ombulFile, ['pdf'])

        const ombul = await prisma.ombul.findUnique({
            where: {
                id: params.id
            }
        })
        if (!ombul) throw new ServiceError('NOT FOUND', 'Ombul ikke funnet')

        const oldFsLocation = ombul.fsLocation

        const ombulUpdated = await prisma.ombul.update({
            where: {
                id: params.id
            },
            data: {
                fsLocation
            },
            include: {
                coverImage: { include: expandedImageIncluder },
                paragraph: true,
            }
        })

        //delete the old file
        await ombulStore.destroyFile(oldFsLocation)

        return ombulUpdated
    }
})

const updateParagraphContent = cmsParagraphOperations.updateContent.implement({
    implementationParamsSchema: z.object({
        ombulId: z.number()
    }),
    authorizer: () => ombulAuth.updateParagraphContent,
    ownershipCheck: async ({ implementationParams, params }) =>
        (await read({
            params: { id: implementationParams.ombulId },
            bypassAuth: true
        })).paragraph.id === params.paragraphId
})

export const ombulOperations = {
    read,
    readAll,
    readLatest,
    updateCoverImage,
    updateParagraphContent,
    destroy,
    create,
    update,
    updateFile
} as const
