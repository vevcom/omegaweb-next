import '@pn-server-only'
import { articleSectionSchemas } from './schemas'
import { articleSectionParts, articleSectionsRelationsIncluder } from './constants'
import { createArticleSectionPart } from './createPart'
import { ServiceError } from '@/services/error'
import { cmsImageOperations } from '@/cms/images/operations'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import {
    defineSubOperation,
} from '@/services/serviceOperation'
import type { ArticleSectionPart } from './types'
import type { z } from 'zod'

/** An article section is addressed by id or by name. */
const articleSectionWhere = (params: z.infer<typeof articleSectionSchemas.params.addPart>) => (
    params.articleSectionId !== undefined ? { id: params.articleSectionId } : { name: params.articleSectionName }
)

const destroyPart = {
    cmsImage: (id: number) => cmsImageOperations.destroy.internalCall({ params: { cmsImageId: id } }),
    cmsParagraph: (id: number) => cmsParagraphOperations.destroy.internalCall({ params: { paragraphId: id } }),
    cmsLink: (id: number) => cmsLinkOperations.destroy.internalCall({ params: { linkId: id } }),
} as const satisfies Record<ArticleSectionPart, (id: number) => Promise<void>>

const create = defineSubOperation({
    dataSchema: () => articleSectionSchemas.data.create,
    operation: () => ({ prisma, data }) =>
        prisma.articleSection.create({
            data,
            include: articleSectionsRelationsIncluder
        })
})

const destroy = defineSubOperation({
    paramsSchema: () => articleSectionSchemas.params.destroy,
    operation: () => ({ prisma, params }) =>
        prisma.articleSection.delete({
            where: articleSectionWhere(params),
            include: articleSectionsRelationsIncluder
        })
})

export const articleSectionOperations = {
    create,
    destroy,
    /**
     * This is the function that updates an article section metadata about how the (cms)image is displayed
     * in the article section. It will also change the image size (resolution) based on the image size in
     * the article section
     * @param params - name or id
     * @param data - The position and size data
     */
    update: defineSubOperation({
        paramsSchema: () => articleSectionSchemas.params.update,
        dataSchema: () => articleSectionSchemas.data.update,
        operation: () => ({ prisma, params, data }) =>
            prisma.articleSection.update({
                where: articleSectionWhere(params),
                data: {
                    imageSize: data.imageSize,
                    imagePosition: data.position,
                },
                include: articleSectionsRelationsIncluder,
            })
    }),

    /**
     * Adds a part - a cmsImage, cmsParagraph or cmsLink - to an article section, created empty by
     * its own service in the same transaction. An article section holds at most one of each, so
     * adding a part it already has is an error.
     * @param params - The name or id of the article section to add the part to
     * @param data - Which part to add
     * @returns - The updated article section
     */
    addPart: defineSubOperation({
        paramsSchema: () => articleSectionSchemas.params.addPart,
        dataSchema: () => articleSectionSchemas.data.addPart,
        opensTransaction: true,
        operation: () => async ({ prisma, params, data }) => prisma.$transaction(async (tx) => {
            const where = articleSectionWhere(params)

            const articleSection = await tx.articleSection.findUnique({
                where,
                select: { [data.part]: { select: { id: true } } },
            })
            if (!articleSection) {
                throw new ServiceError('NOT FOUND', 'ArticleSection not found')
            }
            if (articleSection[data.part]) {
                throw new ServiceError('BAD PARAMETERS', `ArticleSection already has ${data.part}`)
            }

            return tx.articleSection.update({
                where,
                data: await createArticleSectionPart[data.part](tx),
                include: articleSectionsRelationsIncluder,
            })
        }),
    }),

    /**
     * Removes a part - a cmsImage, cmsParagraph or cmsLink - from an article section by deleting
     * it, which sets the part to null on the section. With destroyOnEmpty, the section itself is
     * removed once its last part goes: an article wants its empty sections gone, while a service
     * that uses one article section keeps it however empty.
     * @param params - The name or id of the article section to remove the part from
     * @param data - Which part to remove
     * @returns - The updated article section
     */
    removePart: defineSubOperation({
        paramsSchema: () => articleSectionSchemas.params.removePart,
        dataSchema: () => articleSectionSchemas.data.removePart,
        operation: ({ destroyOnEmpty }: { destroyOnEmpty: boolean }) => async ({ prisma, params, data }) => {
            const where = articleSectionWhere(params)
            const articleSection = await prisma.articleSection.findUnique({
                where,
                select: { id: true, cmsLink: true, cmsParagraph: true, cmsImage: true },
            })
            if (!articleSection) {
                throw new ServiceError('NOT FOUND', 'ArticleSection not found')
            }
            const part = articleSection[data.part]
            if (!part) {
                throw new ServiceError('BAD PARAMETERS', `ArticleSection does not have ${data.part}`)
            }

            await destroyPart[data.part](part.id)

            const isEmptyNow = articleSectionParts.every(kind => kind === data.part || !articleSection[kind])
            if (destroyOnEmpty && isEmptyNow) {
                return destroy.internalCall({ params: { articleSectionId: articleSection.id } })
            }

            return prisma.articleSection.findUniqueOrThrow({
                where,
                include: articleSectionsRelationsIncluder,
            })
        }
    })
} as const
