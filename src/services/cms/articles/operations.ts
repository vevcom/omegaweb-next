import '@ow-server-only'
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

const createSpecial = defineSubOperation({
    paramsSchema: () => articleSchemas.params.createSpecial,
    operation: () => async ({ params }) => create.internalCall({
        data: { name: `Regenerert spesiell ${params.special}` },
        dataSchemaImplementationFields: { maxNameLength: 100 },
        operationImplementationFields: { special: params.special }
    })
})

/**
 * Puts the sections of an article in the order given, which must name each of them once. The orders
 * already in use are dealt out anew, so nothing outside the article is touched.
 */
async function setSectionOrder(prisma: Prisma.TransactionClient, articleId: number, sectionIds: number[]) {
    const sections = await prisma.articleSection.findMany({
        where: { articleId },
        select: { id: true, order: true },
        orderBy: { order: 'asc' },
    })
    const remaining = new Set(sections.map(section => section.id))
    if (sectionIds.length !== sections.length || !sectionIds.every(id => remaining.delete(id))) {
        throw new ServiceError('BAD PARAMETERS', 'Rekkefølgen må inneholde alle seksjonene i artikkelen én gang.')
    }

    // Moved out of the way first: (articleId, order) is unique, so no section can take an order
    // another still holds.
    for (const section of sections) {
        await prisma.articleSection.update({ where: { id: section.id }, data: { order: -section.id } })
    }
    for (let index = 0; index < sections.length; index++) {
        await prisma.articleSection.update({
            where: { id: sectionIds[index] },
            data: { order: sections[index].order },
        })
    }
}

export const articleOperations = {
    create,
    createSpecial,
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
            return createSpecial.internalCall({ params: { special: params.special } })
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
    /** Adds a section where asked, or last, with the parts asked for created empty in the same write. */
    addSection: defineSubOperation({
        paramsSchema: () => articleSchemas.params.addSection,
        dataSchema: () => articleSchemas.data.addSection,
        transaction: 'RUNS_IN',
        // The section and its parts are written together; each part is made by its own service.
        operation: () => async ({ prisma, params, data }) => {
            const article = await prisma.article.findUnique({
                where: { id: params.articleId },
                select: { id: true },
            })
            if (!article) throw new ServiceError('NOT FOUND', 'Artikkel ikke funnet.')

            const sections = await prisma.articleSection.aggregate({
                where: { articleId: params.articleId },
                _count: { _all: true },
                _max: { order: true },
            })
            if (sections._count._all >= maxSections) {
                throw new ServiceError('BAD PARAMETERS', `Maks antall seksjoner er ${maxSections}`)
            }

            const parts = await Promise.all(articleSectionParts
                .filter(part => data.includeParts[part])
                .map(part => createArticleSectionPart[part](prisma)))
            const section = parts.reduce<Prisma.ArticleSectionCreateWithoutArticleInput>(
                (sectionSoFar, part) => ({ ...sectionSoFar, ...part }),
                { order: (sections._max.order ?? -1) + 1 },
            )
            const created = await prisma.articleSection.create({
                data: { ...section, article: { connect: { id: params.articleId } } },
                select: { id: true },
            })
            if (data.afterSectionId !== undefined) {
                const others = await prisma.articleSection.findMany({
                    where: { articleId: params.articleId, id: { not: created.id } },
                    select: { id: true },
                    orderBy: { order: 'asc' },
                })
                const place = data.afterSectionId === null
                    ? 0
                    : others.findIndex(other => other.id === data.afterSectionId) + 1
                if (data.afterSectionId !== null && place === 0) {
                    throw new ServiceError('BAD PARAMETERS', 'Seksjonen det skal settes inn etter finnes ikke i artikkelen.')
                }
                const sectionIds = others.map(other => other.id)
                sectionIds.splice(place, 0, created.id)
                await setSectionOrder(prisma, params.articleId, sectionIds)
            }
            return prisma.article.findUniqueOrThrow({
                where: { id: params.articleId },
                include: articleRelationsIncluder,
            })
        },
    }),
    reorderSections: defineSubOperation({
        paramsSchema: () => articleSchemas.params.reorderSections,
        transaction: 'RUNS_IN',
        dataSchema: () => articleSchemas.data.reorderSections,
        operation: () => async ({ prisma, params, data }) => {
            await setSectionOrder(prisma, params.articleId, data.sectionIds)
        },
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
