import '@pn-server-only'
import { articleRelationsIncluder, maxSections } from './constants'
import { articleSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { articleSectionParts } from '@/cms/articleSections/constants'
import { createArticleSectionPart } from '@/cms/articleSections/createPart'
import { cmsImageOperations } from '@/cms/images/operations'
import logger from '@/lib/logger'
import { ServiceError } from '@/services/error'
import type { SpecialCmsArticle } from '@/prisma-generated-pn-types'
import type { Prisma } from '@/prisma-generated-pn-types'

/** "Ny artikkel", or the first "Ny artikkel N" not taken - found in one query, not one per try. */
async function newArticleName(prisma: Prisma.TransactionClient) {
    const taken = new Set((await prisma.article.findMany({
        where: { name: { startsWith: 'Ny artikkel' } },
        select: { name: true },
    })).map(article => article.name))
    // One more candidate than names taken, so one of them is always free.
    return Array.from({ length: taken.size + 1 }, (_, index) => (index === 0 ? 'Ny artikkel' : `Ny artikkel ${index}`))
        .find(candidate => !taken.has(candidate)) ?? 'Ny artikkel'
}

const create = defineSubOperation({
    dataSchema: ({ maxNameLength }: { maxNameLength: number }) => articleSchemas.data.create({ maxNameLength }),
    operation: ({ special }: { special: SpecialCmsArticle | null }) => async ({ prisma, data }) => prisma.article.create({
        data: {
            name: data.name ?? await newArticleName(prisma),
            coverImage: {
                create: {},
            },
            special
        },
        include: articleRelationsIncluder,
    })
})

const generateSpecialArticleFromConfig = defineSubOperation({
    paramsSchema: () => articleSchemas.params.generateSpecialArticleFromConfig,
    operation: () => async ({ params }) => create.internalCall({
        data: { name: `Regenerert spesiell ${params.special}` },
        dataSchemaImplementationFields: { maxNameLength: 100 },
        operationImplementationFields: { special: params.special }
    })
})

export const articleOperations = {
    create,
    generateSpecialArticleFromConfig,
    destroy: defineSubOperation({
        paramsSchema: () => articleSchemas.params.destroy,
        operation: () => async ({ prisma, params }) => {
            const article = await prisma.article.delete({
                where: {
                    id: params.articleId
                }
            })
            await cmsImageOperations.destroy.internalCall({ params: { cmsImageId: article.coverImageId } })
        }
    }),
    readSpecial: defineSubOperation({
        paramsSchema: () => articleSchemas.params.readSpecial,
        operation: () => async ({ prisma, params }) => {
            const article = await prisma.article.findUnique({
                where: {
                    special: params.special,
                },
                include: articleRelationsIncluder
            })
            if (article) return article
            logger.error(`Special article ${params.special} not found - creating it!`)
            return generateSpecialArticleFromConfig.internalCall({ params: { special: params.special } })
        }
    }),
    /**
     * Update the article metadata like name
     */
    update: defineSubOperation({
        paramsSchema: () => articleSchemas.params.update,
        dataSchema: () => articleSchemas.data.update,
        operation: () => async ({ prisma, params, data }) =>
            prisma.article.update({
                where: { id: params.articleId },
                data,
                include: articleRelationsIncluder,
            })
    }),
    /** Adds a section after the last one, with the parts asked for created empty in the same write. */
    addSection: defineSubOperation({
        paramsSchema: () => articleSchemas.params.addSection,
        dataSchema: () => articleSchemas.data.addSection,
        opensTransaction: true,
        // The section and its parts are written together; each part is made by its own service.
        operation: () => async ({ prisma, params, data }) => prisma.$transaction(async (tx) => {
            const article = await tx.article.findUnique({
                where: { id: params.articleId },
                select: { id: true },
            })
            if (!article) throw new ServiceError('NOT FOUND', 'Artikkel ikke funnet.')

            const sections = await tx.articleSection.aggregate({
                where: { articleId: params.articleId },
                _count: { _all: true },
                _max: { order: true },
            })
            if (sections._count._all >= maxSections) {
                throw new ServiceError('BAD PARAMETERS', `The maximum number of sections is ${maxSections}`)
            }

            const parts = await Promise.all(articleSectionParts
                .filter(part => data.includeParts[part])
                .map(part => createArticleSectionPart[part](tx)))
            const section = parts.reduce<Prisma.ArticleSectionCreateWithoutArticleInput>(
                (sectionSoFar, part) => ({ ...sectionSoFar, ...part }),
                { order: (sections._max.order ?? -1) + 1 },
            )
            return tx.article.update({
                where: { id: params.articleId },
                data: { articleSections: { create: section } },
                include: articleRelationsIncluder,
            })
        }),
    }),
    reorderSections: defineSubOperation({
        paramsSchema: () => articleSchemas.params.reorderSections,
        opensTransaction: true,
        dataSchema: () => articleSchemas.data.reorderSections,
        operation: () => async ({ prisma, params, data }) => prisma.$transaction(async (tx) => {
            const section = await tx.articleSection.findUnique({
                where: {
                    articleId: params.articleId,
                    id: params.sectionId,
                },
            })
            if (!section) throw new ServiceError('NOT FOUND', 'Seksjon ikke funnet.')

            // The neighbour the section swaps places with: the nearest one above or below it.
            const otherSection = await tx.articleSection.findFirst({
                where: {
                    articleId: params.articleId,
                    order: data.direction === 'UP' ? { lt: section.order } : { gt: section.order },
                },
                orderBy: {
                    order: data.direction === 'UP' ? 'desc' : 'asc',
                },
            })
            if (!otherSection) throw new ServiceError('BAD PARAMETERS', 'Seksjon kan ikke flyttes opp/ned.')

            // Swapped by way of -1: (articleId, order) is unique, so neither section can take the
            // other's order while it is still held.
            await tx.articleSection.update({
                where: { id: section.id },
                data: { order: -1 },
            })
            await tx.articleSection.update({
                where: { id: otherSection.id },
                data: { order: section.order },
            })
            return tx.articleSection.update({
                where: { id: section.id },
                data: { order: otherSection.order },
            })
        }),
    }),

    read: defineSubOperation({
        paramsSchema: () => articleSchemas.params.read,
        operation: () => async ({ prisma, params }) => {
            const article = await prisma.article.findUnique({
                where: {
                    id: params.articleId
                },
                include: articleRelationsIncluder
            })
            if (!article) throw new ServiceError('NOT FOUND', 'Artikkel ikke funnet.')
            return article
        }
    })
} as const
