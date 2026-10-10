import '@pn-server-only'
import { articleRelationsIncluder, maxSections } from './constants'
import { articleSchemas } from './schemas'
import { defineSubOperation } from '@/services/serviceOperation'
import { articleSectionOperations } from '@/cms/articleSections/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import logger from '@/lib/logger'
import { ServiceError } from '@/services/error'
import { SpecialCmsArticle } from '@/prisma-generated-pn-types'
import { z } from 'zod'
import { v4 } from 'uuid'
import type { ArticleSectionPart } from '@/cms/articleSections/types'

const create = defineSubOperation({
    dataSchema: ({ maxNameLength }: { maxNameLength: number }) => articleSchemas.create({ maxNameLength }),
    operation: ({ special }: { special: SpecialCmsArticle | null }) => async ({ prisma, data }) => {
        let newName = 'Ny artikkel'
        let i = 1
        if (!data.name) {
            const checkArticleExists = () => prisma.article.findFirst({ where: { name: newName } })

            const maxIter = 30
            while (i < maxIter && await checkArticleExists()) {
                newName = `Ny artikkel ${i++}`
            }
            if (i >= maxIter) {
                newName = v4()
            }
        }
        return await prisma.article.create({
            data: {
                name: data.name ?? newName,
                coverImage: {
                    create: {},
                },
                special
            },
            include: articleRelationsIncluder,
        })
    }
})

const generateSpecialArticleFromConfig = defineSubOperation({
    paramsSchema: () => z.object({
        special: z.nativeEnum(SpecialCmsArticle),
    }),
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
        paramsSchema: () => articleSchemas.params,
        operation: () => async ({ prisma, params }) => {
            const article = await prisma.article.delete({
                where: {
                    id: params.articleId
                }
            })
            cmsImageOperations.destroy.internalCall({ params: { cmsImageId: article.coverImageId } })
        }
    }),
    readSpecial: defineSubOperation({
        paramsSchema: () => z.object({
            special: z.nativeEnum(SpecialCmsArticle),
        }),
        operation: () => async ({ prisma, params }) => {
            const article = await prisma.article.findUnique({
                where: {
                    special: params.special,
                },
                include: articleRelationsIncluder
            })
            if (article) {
                return {
                    ...article,
                    coverImage: article.coverImage
                }
            }
            logger.error(`Special article ${params.special} not found - creating it!`)
            return generateSpecialArticleFromConfig.internalCall({ params: { special: params.special } })
        }
    }),
    /**
     * Update the article metadata like name
     */
    update: defineSubOperation({
        paramsSchema: () => articleSchemas.params,
        dataSchema: () => articleSchemas.update,
        operation: () => async ({ prisma, params, data }) =>
            prisma.article.update({
                where: { id: params.articleId },
                data,
                include: articleRelationsIncluder,
            })
    }),
    addSection: defineSubOperation({
        paramsSchema: () => articleSchemas.params,
        dataSchema: () => articleSchemas.addSection,
        operation: () => async ({ prisma, params, data }) => {
            const article = await prisma.article.findUnique({
                where: {
                    id: params.articleId,
                },
            })
            if (!article) throw new ServiceError('NOT FOUND', 'Artikkel ikke funnet.')

            const highestOrderSection = await prisma.articleSection.findMany({
                where: {
                    articleId: params.articleId,
                },
                orderBy: {
                    order: 'desc',
                },
                take: 1,
            })
            // Get the order of the highest order section, or 0 if there are no sections
            const nextOrder = highestOrderSection.length > 0 ? highestOrderSection[0].order + 1 : 0

            const numberOfSections = await prisma.articleSection.count({
                where: {
                    articleId: params.articleId,
                },
            })
            if (numberOfSections >= maxSections) {
                throw new ServiceError('BAD PARAMETERS', `The maximum number of sections is ${maxSections}`)
            }

            const updatedArticle = await prisma.article.update({
                where: {
                    id: params.articleId,
                },
                data: {
                    articleSections: {
                        create: {
                            order: nextOrder,
                        },
                    },
                },
                include: articleRelationsIncluder,
            })

            const addedArticleSectionId = updatedArticle.articleSections[updatedArticle.articleSections.length - 1].id

            for (const part of ['cmsParagraph', 'cmsLink', 'cmsImage'] satisfies ArticleSectionPart[]) {
                if (data.includeParts[part]) {
                    await articleSectionOperations.addPart.internalCall({
                        data: {
                            part,
                        },
                        params: {
                            articleSectionId: addedArticleSectionId
                        }
                    })
                }
            }
            return await prisma.article.findUniqueOrThrow({
                where: {
                    id: params.articleId,
                },
                include: articleRelationsIncluder,
            })
        }
    }),
    reorderSections: defineSubOperation({
        paramsSchema: () => articleSchemas.params.extend({
            sectionId: z.number()
        }),
        opensTransaction: true,
        dataSchema: () => articleSchemas.reorderSections,
        operation: () => async ({ prisma, params, data }) => {
            const section = await prisma.articleSection.findUnique({
                where: {
                    articleId: params.articleId,
                    id: params.sectionId,
                },
            })
            if (!section) throw new ServiceError('NOT FOUND', 'Seksjon ikke funnet.')

            //find the section with the order one higher/lower than the current section
            const otherSection = await prisma.articleSection.findMany({
                where: {
                    articleId: params.articleId,
                    order: data.direction === 'UP' ? {
                        lt: section.order,
                    } : {
                        gt: section.order,
                    },
                },
                orderBy: {
                    order: data.direction === 'UP' ? 'desc' : 'asc',
                },
                take: 1,
            }).then(
                res => (res.length > 0 ? res[0] : null)
            )
            if (!otherSection) throw new ServiceError('BAD PARAMETERS', 'Seksjon kan ikke flyttes opp/ned.')

            //flip thir order numbers
            const tempOrder = -1 // Or any other value that won't violate the unique constraint

            // First, set the order of the section to the temporary value
            return await prisma.$transaction(async (tx) => {
                await tx.articleSection.update({
                    where: {
                        articleId: params.articleId,
                        id: section.id
                    },
                    data: { order: tempOrder },
                })
                const updatedOtherSection = await tx.articleSection.update({
                    where: {
                        articleId: params.articleId,
                        id: otherSection.id
                    },
                    data: { order: section.order },
                })
                // Finally, set the order of the section to the otherSection's original order
                const updatedSection = await tx.articleSection.update({
                    where: {
                        articleId: params.articleId,
                        id: section.id
                    },
                    data: { order: otherSection.order },
                })

                if (!updatedSection || !updatedOtherSection) {
                    throw new ServiceError('UNKNOWN ERROR', 'Noe uventet skjedde under flytting av seksjonen.')
                }

                return updatedSection
            })
        }
    }),

    read: defineSubOperation({
        paramsSchema: () => articleSchemas.params,
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
