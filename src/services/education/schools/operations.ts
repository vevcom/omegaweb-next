import '@pn-server-only'
import { schoolAuth } from './auth'
import { schoolSchemas } from './schemas'
import { schoolFilteredSelection, schoolRelationIncluder, standardSchoolsConfig } from './constants'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { ServiceError } from '@/services/error'
import logger from '@/lib/logger'
import { StandardSchool } from '@/prisma-generated-pn-types'

const read = defineOperation({
    authorizer: () => schoolAuth.read,
    paramsSchema: schoolSchemas.params.read,
    operation: ({ params, prisma }) =>
        prisma.school.findUniqueOrThrow({
            where: {
                shortName: params.shortName
            },
            select: {
                ...schoolFilteredSelection,
                ...schoolRelationIncluder,
            },
        })
})

/**
 * Creates a school with its own empty CMS image, paragraph and link, all in one transaction, so a
 * failed insert leaves no orphaned CMS rows behind.
 */
const create = defineOperation({
    authorizer: () => schoolAuth.create,
    dataSchema: schoolSchemas.data.create,
    opensTransaction: true,
    operation: async ({ prisma, data }) => prisma.$transaction(async tx => {
        const cmsImage = await cmsImageOperations.create.internalCall({
            data: {},
            prisma: tx,
            operationImplementationFields: { special: null }
        })
        const cmsParagraph = await cmsParagraphOperations.create.internalCall({
            data: {},
            prisma: tx,
            operationImplementationFields: { special: null }
        })
        const cmsLink = await cmsLinkOperations.create.internalCall({
            data: { text: 'link', url: './' },
            prisma: tx,
            operationImplementationFields: { special: null }
        })

        return tx.school.create({
            data: {
                name: data.name,
                shortName: data.shortName,
                standardSchool: data.standardSchool,
                cmsImage: {
                    connect: {
                        id: cmsImage.id
                    }
                },
                cmsParagraph: {
                    connect: {
                        id: cmsParagraph.id
                    }
                },
                cmsLink: {
                    connect: {
                        id: cmsLink.id
                    }
                },
            },
            select: schoolFilteredSelection,
        })
    })
})

const createStandard = defineOperation({
    authorizer: () => schoolAuth.createStandard,
    paramsSchema: schoolSchemas.params.createStandard,
    opensTransaction: true,
    operation: ({ params }) =>
        // Called only internally by readStandard to lazily seed missing standard schools, so it
        // bypasses the SCHOOLS_ADMIN authorizer while inheriting the ambient prisma/session.
        create({
            data: {
                ...standardSchoolsConfig[params.standardSchool],
                standardSchool: params.standardSchool,
            },
            bypassAuth: true,
        })
})

const updateCmsParagraphContent = cmsParagraphOperations.updateContent.implement({
    authorizer: () => schoolAuth.updateCmsParagraphContent,
    implementationParamsSchema: schoolSchemas.params.updateCmsParagraphContent,
    ownershipCheck: async ({ params, implementationParams }) => {
        const school = await read({ params: implementationParams })
        return school.cmsParagraph.id === params.paragraphId
    }
})

const updateCmsImage = cmsImageOperations.update.implement({
    authorizer: () => schoolAuth.updateCmsImage,
    implementationParamsSchema: schoolSchemas.params.updateCmsImage,
    ownershipCheck: async ({ params, implementationParams }) => {
        const school = await read({ params: implementationParams })
        return school.cmsImage.id === params.cmsImageId
    }
})

const updateCmsLink = cmsLinkOperations.update.implement({
    authorizer: () => schoolAuth.updateCmsLink,
    implementationParamsSchema: schoolSchemas.params.updateCmsLink,
    ownershipCheck: async ({ params, implementationParams }) => {
        const school = await read({ params: implementationParams })
        return school.cmsLink.id === params.linkId
    }
})

export const schoolOperations = {
    read,
    create,
    createStandard,
    destroy: defineOperation({
        authorizer: () => schoolAuth.destroy,
        paramsSchema: schoolSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async tx => {
            const school = await tx.school.findUniqueOrThrow({
                where: { id: params.id },
                select: { standardSchool: true },
            })
            if (school.standardSchool) throw new ServiceError('BAD PARAMETERS', 'Kan ikke slette standard skole')

            // The school holds the foreign keys to its CMS parts, so it goes first and they after.
            const { cmsImageId, cmsParagraphId, cmsLinkId } = await tx.school.delete({ where: { id: params.id } })
            await cmsImageOperations.destroy.internalCall({ params: { cmsImageId }, prisma: tx })
            await cmsParagraphOperations.destroy.internalCall({ params: { paragraphId: cmsParagraphId }, prisma: tx })
            await cmsLinkOperations.destroy.internalCall({ params: { linkId: cmsLinkId }, prisma: tx })
        }),
    }),
    readExpandedPage: defineOperation({
        authorizer: () => schoolAuth.readExpandedPage,
        paramsSchema: schoolSchemas.params.readExpandedPage,
        operation: ({ prisma, params }) =>
            prisma.school.findMany({
                select: {
                    ...schoolFilteredSelection,
                    ...schoolRelationIncluder,
                },
                orderBy: [
                    { standardSchool: 'asc' },
                    { shortName: 'asc' },
                    { id: 'asc' },
                ],
                ...cursorPagingSelection(params.paging.page),
            })
    }),
    /**
     * Reads the standard schools, creating any that is missing. Two first requests may both find a
     * school missing; the one that loses the race to create it reads the winner's school instead.
     */
    readStandard: defineOperation({
        authorizer: () => schoolAuth.readStandard,
        opensTransaction: true,
        operation: ({ prisma }) =>
            Promise.all(Object.values(StandardSchool).map(async standardSchool => {
                const readSchool = () => prisma.school.findUnique({
                    where: { standardSchool },
                    select: schoolFilteredSelection,
                })
                const school = await readSchool()
                if (school) return school

                logger.warn(`Standard school ${standardSchool} not found in database - creating....`)
                try {
                    return await createStandard({ params: { standardSchool }, bypassAuth: true })
                } catch (error) {
                    if (!(error instanceof ServiceError) || error.errorCode !== 'DUPLICATE') throw error
                    return prisma.school.findUniqueOrThrow({
                        where: { standardSchool },
                        select: schoolFilteredSelection,
                    })
                }
            }))
    }),
    readMany: defineOperation({
        authorizer: () => schoolAuth.readMany,
        paramsSchema: schoolSchemas.params.readMany,
        operation: ({ prisma, params }) =>
            prisma.school.findMany({
                where: params.onlyNonStandard ? {
                    standardSchool: null,
                } : undefined,
                select: schoolFilteredSelection,
            })
    }),
    update: defineOperation({
        authorizer: () => schoolAuth.update,
        paramsSchema: schoolSchemas.params.update,
        dataSchema: schoolSchemas.data.update,
        operation: ({ prisma, params, data }) =>
            prisma.school.update({
                where: { id: params.id },
                data,
                select: schoolFilteredSelection,
            })
    }),
    updateCmsParagraphContent,
    updateCmsImage,
    updateCmsLink,
} as const
