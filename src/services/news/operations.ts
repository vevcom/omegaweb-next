import '@pn-server-only'
import { newsSchemas } from './schemas'
import {
    defaultNewsArticleOldCutoff,
    newsArticleOrdering,
    newsArticleRelationsIncluder,
    simpleNewsArticleRelationsIncluder
} from './constants'
import { newsAuth } from './auth'
import { articleOperations } from '@/cms/articles/operations'
import { notificationOperations } from '@/services/notifications/operations'
import { visibilityOperations } from '@/services/visibility/operations'
import {
    assertAdminLevelIsSubOfRegularLevel,
    implementDoubleLevelVisibilityOperations
} from '@/services/visibility/implement'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { implementUpdateArticleOperations } from '@/cms/articles/implement'
import type { VisibilityFilter } from '@/auth/visibility/visibilityFilter'
import type { Prisma } from '@/prisma-generated-pn-types'

const visibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: newsSchemas.params.visibility,
    authorizers: {
        readDoubleLevelMatrix: ({ doubleLevelMatrix }) =>
            newsAuth.readDoubleLevelMatrix.data({ visibility: doubleLevelMatrix }),
        updateRegularLevel: ({ doubleLevelMatrix }) =>
            newsAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix }),
        updateAdminLevel: ({ doubleLevelMatrix }) =>
            newsAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix })
    },
    readDoubleLevel: async ({ prisma, implementationParams, include }) => {
        const news = await prisma.newsArticle.findUniqueOrThrow({
            where: { id: implementationParams.id },
            include: {
                visibilityRegular: { include },
                visibilityAdmin: { include }
            }
        })
        return {
            regularLevel: news.visibilityRegular,
            adminLevel: news.visibilityAdmin
        }
    }
})

export const newsOperations = {
    visibility,
    create: defineOperation({
        authorizer: () => newsAuth.create,
        dataSchema: newsSchemas.data.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.visibilityRegularRequirements },
                adminLevel: { requirements: data.visibilityAdminRequirements },
            })

            const defaultEndDateTime = new Date()
            defaultEndDateTime.setDate(defaultEndDateTime.getDate() + defaultNewsArticleOldCutoff)

            return prisma.$transaction(async tx => {
                const article = await articleOperations.create.internalCall({
                    prisma: tx,
                    data: { name: data.name },
                    dataSchemaImplementationFields: { maxNameLength: 30 },
                    operationImplementationFields: { special: null }
                })
                const visibilityRegular = await visibilityOperations.createWithRequirements.internalCall({
                    prisma: tx,
                    data: { requirements: data.visibilityRegularRequirements },
                })
                const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                    prisma: tx,
                    data: { requirements: data.visibilityAdminRequirements },
                })

                return tx.newsArticle.create({
                    data: {
                        description: data.description,
                        endDateTime: data.endDateTime ?? defaultEndDateTime,
                        article: { connect: { id: article.id } },
                        visibilityRegular: { connect: { id: visibilityRegular.id } },
                        visibilityAdmin: { connect: { id: visibilityAdmin.id } },
                    },
                    include: newsArticleRelationsIncluder,
                })
            })
        }
    }),
    destroy: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.destroy.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
            }),
        paramsSchema: newsSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            await prisma.$transaction(async tx => {
                // The news row goes first: it restricts the deletion of its article and visibilities.
                const news = await tx.newsArticle.delete({ where: { id: params.id } })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: news.visibilityAdminId },
                })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: news.visibilityRegularId },
                })
                await articleOperations.destroy.internalCall({
                    prisma: tx,
                    params: { articleId: news.articleId },
                })
            })
        }
    }),
    readCurrent: defineOperation({
        authorizer: () => newsAuth.readCurrent,
        operation: async ({ prisma }, visibilityWhereFilter) => {
            const news = await prisma.newsArticle.findMany({
                where: {
                    endDateTime: { gte: new Date() },
                    ...visibleNewsFilter(visibilityWhereFilter),
                },
                orderBy: newsArticleOrdering,
                include: simpleNewsArticleRelationsIncluder,
            })
            return news.map(withCoverImage)
        }
    }),
    readOldPage: defineOperation({
        paramsSchema: newsSchemas.params.readOldPage,
        authorizer: () => newsAuth.readOldPage,
        operation: async ({ prisma, params }, visibilityWhereFilter) => {
            const news = await prisma.newsArticle.findMany({
                where: {
                    endDateTime: { lt: new Date() },
                    ...visibleNewsFilter(visibilityWhereFilter),
                },
                ...cursorPagingSelection(params.paging.page),
                orderBy: newsArticleOrdering,
                include: simpleNewsArticleRelationsIncluder,
            })
            return news.map(withCoverImage)
        }
    }),
    read: defineOperation({
        paramsSchema: newsSchemas.params.read,
        authorizer: async ({ params, prisma }) => {
            const { published } = await prisma.newsArticle.findUniqueOrThrow({
                where: { id: params.id },
                select: { published: true },
            })
            return newsAuth.read.data({
                published,
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
            })
        },
        operation: async ({ prisma, params }) => prisma.newsArticle.findUniqueOrThrow({
            where: { id: params.id },
            include: newsArticleRelationsIncluder
        })
    }),
    update: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.update.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
            }),
        paramsSchema: newsSchemas.params.update,
        dataSchema: newsSchemas.data.update,
        operation: async ({ prisma, params, data }) =>
            prisma.newsArticle.update({
                where: { id: params.id },
                data: {
                    description: data.description,
                    article: {
                        update: {
                            name: data.name
                        }
                    },
                    endDateTime: data.endDateTime || undefined,
                }
            })
    }),
    /**
     * Publishes an article, or takes it back to being a draft. Which of the two levels the read
     * authorizer demands follows from this flag, so retracting an article makes it visible only to
     * those who can administrate it again.
     */
    setPublished: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.setPublished.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
            }),
        paramsSchema: newsSchemas.params.setPublished,
        dataSchema: newsSchemas.data.setPublished,
        operation: async ({ prisma, params, data }) => {
            const previous = await prisma.newsArticle.findUniqueOrThrow({
                where: { id: params.id },
                select: { published: true },
            })
            const news = await prisma.newsArticle.update({
                where: { id: params.id },
                data: { published: data.published },
                include: simpleNewsArticleRelationsIncluder,
            })

            if (data.published && !previous.published) {
                await notificationOperations.createSpecial.internalCall({
                    params: {
                        special: 'NEW_NEWS_ARTICLE',
                    },
                    data: {
                        title: `Ny nyhetsartikkel: ${news.article.name}`,
                        message: `${news.description ? `${news.description}\n` : ''}Les hele saken på Omegaveven.`,
                        audience: { visibilityId: news.visibilityRegularId },
                    },
                })
            }

            return withCoverImage(news)
        }
    }),
    updateArticle: implementUpdateArticleOperations({
        implementationParamsSchema: newsSchemas.params.updateArticle,
        authorizer: async ({ implementationParams, prisma }) =>
            newsAuth.updateArticle.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({
                    params: { id: implementationParams.newsId },
                    prisma
                })
            }),
        ownedArticles: async ({ implementationParams, prisma }) => {
            const news = await prisma.newsArticle.findUniqueOrThrow({
                where: { id: implementationParams.newsId },
                include: newsArticleRelationsIncluder,
            })
            return [news.article]
        }
    })
} as const

/**
 * The same rule as the read authorizer, as a filter over a list of news articles: published ones
 * at the regular level, drafts at the admin level.
 *
 * The visibility filter is undefined only when the session bypasses visibility with NEWS_ADMIN,
 * which administrates every article - hence no filtering at all in that case.
 */
function visibleNewsFilter(visibilityWhereFilter: VisibilityFilter | undefined): Prisma.NewsArticleWhereInput {
    if (!visibilityWhereFilter) return {}
    return {
        OR: [
            { published: true, visibilityRegular: visibilityWhereFilter },
            { published: false, visibilityAdmin: visibilityWhereFilter },
        ]
    }
}

/** Lifts the cover image out of the article, the shape the news lists and cards are built on. */
function withCoverImage<News extends Prisma.NewsArticleGetPayload<{ include: typeof simpleNewsArticleRelationsIncluder }>>(
    news: News
) {
    return {
        ...news,
        coverImage: news.article.coverImage.image
    }
}
