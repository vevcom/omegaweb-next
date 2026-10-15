import '@pn-server-only'
import { screenPageAuth } from './auth'
import { screenPageIncluder } from './constants'
import { screenPageSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import type { ExpandedScreenPage } from './types'

export const screenPageOperations = {
    /**
     * Creates a page showing text and an image, with its own CMS image and paragraph. Its type and
     * what it links to are set with update.
     */
    create: defineOperation({
        dataSchema: screenPageSchemas.data.create,
        authorizer: () => screenPageAuth.create,
        opensTransaction: true,
        operation: ({ prisma, data }) => prisma.$transaction(async tx => {
            const cmsImage = await cmsImageOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })
            const cmsParagraph = await cmsParagraphOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })
            return tx.screenPage.create({
                data: {
                    name: data.name,
                    type: 'TEXT_AND_IMAGE',
                    cmsImageId: cmsImage.id,
                    cmsParagraphId: cmsParagraph.id,
                },
            })
        }),
    }),

    read: defineOperation({
        paramsSchema: screenPageSchemas.params.read,
        authorizer: () => screenPageAuth.read,
        operation: ({ prisma, params }): Promise<ExpandedScreenPage> => prisma.screenPage.findUniqueOrThrow({
            where: { id: params.id },
            include: screenPageIncluder,
        }),
    }),

    readMany: defineOperation({
        authorizer: () => screenPageAuth.readMany,
        operation: ({ prisma }) => prisma.screenPage.findMany({
            orderBy: { name: 'asc' },
        }),
    }),

    update: defineOperation({
        paramsSchema: screenPageSchemas.params.update,
        dataSchema: screenPageSchemas.data.update,
        authorizer: () => screenPageAuth.update,
        operation: ({ prisma, params, data }) => prisma.screenPage.update({
            where: { id: params.id },
            data,
        }),
    }),

    updateCmsImage: cmsImageOperations.update.implement({
        implementationParamsSchema: screenPageSchemas.params.updateCmsImage,
        authorizer: () => screenPageAuth.updateCmsImage,
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.screenPage.findUniqueOrThrow({
                where: { id: implementationParams.screenPageId },
                select: { cmsImageId: true },
            })).cmsImageId === params.cmsImageId,
    }),

    updateCmsParagraphContent: cmsParagraphOperations.updateContent.implement({
        implementationParamsSchema: screenPageSchemas.params.updateCmsParagraphContent,
        authorizer: () => screenPageAuth.updateCmsParagraphContent,
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.screenPage.findUniqueOrThrow({
                where: { id: implementationParams.screenPageId },
                select: { cmsParagraphId: true },
            })).cmsParagraphId === params.paragraphId,
    }),

    /**
     * Destroys a page with its CMS image and paragraph, and takes it off every screen showing it.
     */
    destroy: defineOperation({
        paramsSchema: screenPageSchemas.params.destroy,
        authorizer: () => screenPageAuth.destroy,
        opensTransaction: true,
        operation: ({ prisma, params }) => prisma.$transaction(async tx => {
            // The CMS parts are on the page's side of the relations, so they do not cascade.
            const page = await tx.screenPage.delete({
                where: { id: params.id },
                select: { cmsImageId: true, cmsParagraphId: true },
            })
            await cmsImageOperations.destroy.internalCall({ params: { cmsImageId: page.cmsImageId }, prisma: tx })
            await cmsParagraphOperations.destroy.internalCall({ params: { paragraphId: page.cmsParagraphId }, prisma: tx })
        }),
    }),
} as const
