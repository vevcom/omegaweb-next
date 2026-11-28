import '@ow-server-only'
import { newsSchemas } from './schemas'
import {
    defaultNewsArticleOldCutoff,
    newsArticleOrdering,
    newsArticleRelationsIncluder,
    simpleNewsArticleRelationsIncluder
} from './constants'
import { newsAuth } from './auth'
import { newNewsArticleNotificationChannel } from './newNewsArticleNotificationChannel'
import { omegaLinks } from '@/app/(omegaweb)/links'
import { implementDoubleLevelVisibilityOperations } from '@/services/visibility/implement'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { implementArticleOperations } from '@/cms/articles/implement'
import { implementSearchOperation } from '@/services/search/implement'
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

const article = implementArticleOperations({
    maxNameLength: 30,
    implementationParamsSchema: newsSchemas.params.article,
    authorizer: async ({ implementationParams, prisma }) =>
        newsAuth.updateArticle.data({
            visibility: await visibility.internal.readDoubleLevelMatrix.internalCall({
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

export const newsOperations = {
    visibility,
    create: defineOperation({
        authorizer: () => newsAuth.create,
        dataSchema: newsSchemas.data.create,
        transaction: 'RUNS_IN',
        read: false,
        operation: async ({ prisma, data }) => {
            const { name, description, endDateTime } = data

            const backupEndDateTime = new Date(Date.now() + defaultNewsArticleOldCutoff * 24 * 60 * 60 * 1000)

            const createdArticle = await article.internal.create.internalCall({ prisma, data: { name } })
            const visibilityRegular = await visibility.internal.create.internalCall({
                prisma,
                data: { requirements: data.visibilityRegularRequirements },
            })
            const visibilityAdmin = await visibility.internal.create.internalCall({
                prisma,
                data: { requirements: data.visibilityAdminRequirements },
            })

            return prisma.newsArticle.create({
                data: {
                    description,
                    endDateTime: endDateTime ?? backupEndDateTime,
                    article: { connect: { id: createdArticle.id } },
                    visibilityRegular: { connect: { id: visibilityRegular.id } },
                    visibilityAdmin: { connect: { id: visibilityAdmin.id } },
                },
                include: newsArticleRelationsIncluder,
            })
        }
    }),
    destroy: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.destroy.data({
                visibility: await visibility.internal.readDoubleLevelMatrix.internalCall({ params, prisma })
            }),
        paramsSchema: newsSchemas.params.destroy,
        transaction: 'RUNS_IN',
        read: false,
        operation: async ({ prisma, params }) => {
            // The news row goes first: it restricts the deletion of its article and visibilities.
            const news = await prisma.newsArticle.delete({ where: { id: params.id } })
            await visibility.internal.destroy.internalCall({
                prisma,
                params: { visibilityId: news.visibilityAdminId },
            })
            await visibility.internal.destroy.internalCall({
                prisma,
                params: { visibilityId: news.visibilityRegularId },
            })
            await article.internal.destroy.internalCall({
                prisma,
                params: { articleId: news.articleId },
            })
        }
    }),
    readCurrent: defineOperation({
        authorizer: () => newsAuth.readCurrent,
        read: true,
        operation: async ({ prisma }, prismaWhereFilter) => {
            const news = await prisma.newsArticle.findMany({
                where: {
                    endDateTime: { gte: new Date() },
                    ...prismaWhereFilter,
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
        read: true,
        operation: async ({ prisma, params }, prismaWhereFilter) => {
            const news = await prisma.newsArticle.findMany({
                where: {
                    endDateTime: { lt: new Date() },
                    ...prismaWhereFilter,
                },
                ...cursorPagingSelection(params.paging.page),
                orderBy: newsArticleOrdering,
                include: simpleNewsArticleRelationsIncluder,
            })
            return news.map(withCoverImage)
        }
    }),
    search: implementSearchOperation({
        authorizer: () => newsAuth.search,
        find: async ({ prisma, query, take, prismaWhereFilter }) => {
            const news = await prisma.newsArticle.findMany({
                take,
                where: {
                    article: { name: { contains: query, mode: 'insensitive' } },
                    ...prismaWhereFilter,
                },
                orderBy: newsArticleOrdering,
                include: simpleNewsArticleRelationsIncluder,
            })
            return news.map(withCoverImage)
        },
        toSearchResult: news => ({
            key: `news-${news.id}`,
            href: omegaLinks.news({ articleName: news.article.name, id: news.id }),
            label: news.article.name,
            sublabel: news.published ? undefined : 'Utkast',
            image: news.coverImage,
        }),
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
                visibility: await visibility.internal.readDoubleLevelMatrix.internalCall({ params, prisma })
            })
        },
        read: true,
        operation: async ({ prisma, params }) => prisma.newsArticle.findUniqueOrThrow({
            where: { id: params.id },
            include: newsArticleRelationsIncluder
        })
    }),
    update: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.update.data({
                visibility: await visibility.internal.readDoubleLevelMatrix.internalCall({ params, prisma })
            }),
        paramsSchema: newsSchemas.params.update,
        dataSchema: newsSchemas.data.update,
        read: false,
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
                    endDateTime: data.endDateTime ?? undefined,
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
                visibility: await visibility.internal.readDoubleLevelMatrix.internalCall({ params, prisma })
            }),
        paramsSchema: newsSchemas.params.setPublished,
        dataSchema: newsSchemas.data.setPublished,
        read: false,
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
                await newNewsArticleNotificationChannel.internal.createNotification.internalCall({
                    data: {
                        title: `Ny nyhetsartikkel: ${news.article.name}`,
                        message: `${news.description ? `${news.description}\n` : ''}Les hele saken på Omegaveven.`,
                        url: omegaLinks.news(news),
                        audience: { visibilityId: news.visibilityRegularId },
                    },
                })
            }

            return withCoverImage(news)
        }
    }),
    article,
} as const

/** Lifts the cover image out of the article, the shape the news lists and cards are built on. */
function withCoverImage<News extends Prisma.NewsArticleGetPayload<{ include: typeof simpleNewsArticleRelationsIncluder }>>(
    news: News
) {
    return {
        ...news,
        coverImage: news.article.coverImage.image
    }
}
