import '@pn-server-only'
import { articleCategoryAuth } from './auth'
import { articleCategoryParamsSchemas, articleCategorySchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { implementUpdateArticleOperations } from '@/cms/articles/implement'
import { articleOperations } from '@/cms/articles/operations'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import {
    assertAdminLevelIsSubOfRegularLevel,
    implementDoubleLevelVisibilityOperations
} from '@/services/visibility/implement'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** The cover of a category is the cover image of its newest article. */
const coverImageSelection = {
    coverImage: {
        select: { image: { include: expandedImageIncluder } },
    },
} as const

const visibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: articleCategoryParamsSchemas.visibility,
    authorizers: {
        readDoubleLevelMatrix: ({ doubleLevelMatrix }) =>
            articleCategoryAuth.readDoubleLevelMatrix.data({ visibility: doubleLevelMatrix }),
        updateRegularLevel: ({ doubleLevelMatrix }) =>
            articleCategoryAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix }),
        updateAdminLevel: ({ doubleLevelMatrix }) =>
            articleCategoryAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    },
    readDoubleLevel: async ({ prisma, implementationParams, include }) => {
        const category = await prisma.articleCategory.findUniqueOrThrow({
            where: { id: implementationParams.id },
            include: {
                visibilityRegular: { include },
                visibilityAdmin: { include }
            }
        })
        return {
            regularLevel: category.visibilityRegular,
            adminLevel: category.visibilityAdmin
        }
    }
})

/**
 * The pages address a category by its name, the operations that change it by its id.
 */
async function readDoubleLevelMatrixByName(prisma: PrismaPossibleTransaction<false>, name: string) {
    const { id } = await prisma.articleCategory.findUniqueOrThrow({
        where: { name },
        select: { id: true }
    })
    return visibility.readDoubleLevelMatrixInternal({ params: { id }, prisma })
}

export const articleCategoryOperations = {
    visibility,

    create: defineOperation({
        authorizer: () => articleCategoryAuth.create,
        dataSchema: articleCategorySchemas.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.visibilityRegularRequirements },
                adminLevel: { requirements: data.visibilityAdminRequirements },
            })

            return prisma.$transaction(async tx => {
                const visibilityRegular = await visibilityOperations.createWithRequirements.internalCall({
                    prisma: tx,
                    data: { requirements: data.visibilityRegularRequirements },
                })
                const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                    prisma: tx,
                    data: { requirements: data.visibilityAdminRequirements },
                })

                return await tx.articleCategory.create({
                    data: {
                        name: data.name,
                        description: data.description,
                        visibilityRegular: {
                            connect: {
                                id: visibilityRegular.id
                            }
                        },
                        visibilityAdmin: {
                            connect: {
                                id: visibilityAdmin.id
                            }
                        },
                    },
                    include: {
                        articles: true
                    },
                })
            })
        }
    }),

    destroy: defineOperation({
        authorizer: () => articleCategoryAuth.destroy,
        paramsSchema: articleCategoryParamsSchemas.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async tx => {
            // The articles cascade with the category, but their cover images would stay behind:
            // the relation is on the article. Destroying each article takes its cover with it.
            const articles = await tx.article.findMany({
                where: { articleCategoryId: params.id },
                select: { id: true },
            })
            await Promise.all(articles.map(article =>
                articleOperations.destroy.internalCall({ params: { articleId: article.id }, prisma: tx })
            ))

            const category = await tx.articleCategory.delete({ where: { id: params.id } })
            await visibilityOperations.destroy.internalCall({
                prisma: tx,
                params: { visibilityId: category.visibilityAdminId },
            })
            await visibilityOperations.destroy.internalCall({
                prisma: tx,
                params: { visibilityId: category.visibilityRegularId },
            })
            return category
        }),
    }),

    update: defineOperation({
        authorizer: async ({ params, prisma }) => articleCategoryAuth.update.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        paramsSchema: articleCategoryParamsSchemas.update,
        dataSchema: articleCategorySchemas.update,
        operation: ({ prisma, data, params }) =>
            prisma.articleCategory.update({
                where: {
                    id: params.id
                },
                data,
                include: {
                    articles: true
                }
            })
    }),

    addArticleToCategory: defineOperation({
        authorizer: async ({ params, prisma }) => articleCategoryAuth.addArticleToCategory.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
        }),
        paramsSchema: articleCategoryParamsSchemas.addArticleToCategory,
        opensTransaction: true,
        operation: ({ prisma, params }) =>
            prisma.$transaction(async (tx) => {
                const article = await articleOperations.create.internalCall({
                    data: {},
                    prisma: tx,
                    dataSchemaImplementationFields: { maxNameLength: 30 },
                    operationImplementationFields: { special: null }
                })
                await tx.articleCategory.update({
                    where: {
                        id: params.id
                    },
                    data: {
                        articles: {
                            connect: {
                                id: article.id
                            }
                        }
                    }
                })
                return article
            })
    }),

    removeArticleFromCategory: articleOperations.destroy.implement({
        authorizer: async ({ implementationParams, prisma }) => articleCategoryAuth.removeArticleFromCategory.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({
                params: { id: implementationParams.articleCategoryId },
                prisma
            })
        }),
        implementationParamsSchema: articleCategoryParamsSchemas.removeArticleFromCategory,
        ownershipCheck: async ({ prisma, params, implementationParams }) => {
            const article = await prisma.article.findUnique({
                where: { id: params.articleId },
                select: { articleCategoryId: true },
            })
            if (!article) throw new ServiceError('NOT FOUND', 'Artikkel ikke funnet.')
            return article.articleCategoryId === implementationParams.articleCategoryId
        }
    }),

    updateArticle: implementUpdateArticleOperations({
        authorizer: async ({ implementationParams, prisma }) => articleCategoryAuth.updateArticle.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({
                params: { id: implementationParams.articleCategoryId },
                prisma
            })
        }),
        implementationParamsSchema: articleCategoryParamsSchemas.updateArticle,
        ownedArticles: ({ implementationParams, prisma }) => prisma.article.findMany({
            where: {
                articleCategoryId: implementationParams.articleCategoryId
            },
            include: {
                coverImage: true,
                articleSections: {
                    include: {
                        cmsImage: true,
                        cmsLink: true,
                        cmsParagraph: true
                    }
                }
            }
        })
    }),

    readAll: defineOperation({
        authorizer: () => articleCategoryAuth.readAll,
        operation: async ({ prisma }, prismaWhereFilter) => {
            const categories = await prisma.articleCategory.findMany({
                // No filter means the session bypasses the regular level with ARTICLE_CATEGORY_ADMIN.
                where: prismaWhereFilter ? { visibilityRegular: prismaWhereFilter } : undefined,
                include: {
                    articles: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                        select: coverImageSelection,
                    },
                },
                orderBy: {
                    createdAt: 'desc'
                }
            })
            return categories.map(({ articles, ...category }) => ({
                ...category,
                coverImage: articles[0]?.coverImage.image ?? null,
            }))
        }
    }),

    /**
     * Returns the category with both of its visibility levels, so the pages under it can decide which
     * editing controls to show.
     */
    read: defineOperation({
        authorizer: async ({ params, prisma }) => articleCategoryAuth.read.data({
            visibility: await readDoubleLevelMatrixByName(prisma, params.name)
        }),
        paramsSchema: articleCategoryParamsSchemas.read,
        operation: async ({ prisma, params }) => {
            const category = await prisma.articleCategory.findUnique({
                where: {
                    name: params.name
                },
                include: {
                    articles: {
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
            })
            if (!category) throw new ServiceError('NOT FOUND', `Category ${params.name} not found`)
            const newestArticle = category.articles[0]
            const coverImage = newestArticle ? await prisma.cmsImage.findUniqueOrThrow({
                where: { id: newestArticle.coverImageId },
                select: coverImageSelection.coverImage.select,
            }).then(cover => cover.image) : null
            return {
                ...category,
                coverImage,
                visibility: await visibility.readDoubleLevelMatrixInternal({ params: { id: category.id }, prisma }),
            }
        }
    }),

    readArticleInCategory: articleOperations.read.implement({
        authorizer: async ({ implementationParams, prisma }) => articleCategoryAuth.readArticleInCategory.data({
            visibility: await readDoubleLevelMatrixByName(prisma, implementationParams.articleCategoryName)
        }),
        implementationParamsSchema: articleCategoryParamsSchemas.readArticleInCategory,
        ownershipCheck: async ({ prisma, params, implementationParams }) => {
            const article = await prisma.article.findUnique({
                where: { id: params.articleId },
                select: { articleCategoryId: true },
            })
            if (!article) throw new ServiceError('NOT FOUND', 'Artikkel ikke funnet.')
            const category = await prisma.articleCategory.findUniqueOrThrow({
                where: { name: implementationParams.articleCategoryName },
                select: { id: true },
            })
            return article.articleCategoryId === category.id
        }
    })
} as const
