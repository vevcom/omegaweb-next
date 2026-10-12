import '@pn-server-only'
import { newsSchemas } from './schemas'
import { defaultNewsArticleOldCutoff, newsArticleRealtionsIncluder, simpleNewsArticleRealtionsIncluder } from './constants'
import { newsAuth } from './auth'
import { articleOperations } from '@/cms/articles/operations'
import { notificationOperations } from '@/services/notifications/operations'
import { visibilityOperations } from '@/services/visibility/operations'
import {
    assertAdminLevelIsSubOfRegularLevel,
    implementDoubleLevelVisibilityOperations,
    toMatrix,
    visibilityIncluder
} from '@/services/visibility/implement'
import { defineOperation } from '@/services/serviceOperation'
import { cursorPagingSelection } from '@/lib/paging/cursorPagingSelection'
import { ServiceError } from '@/services/error'
import { implementUpdateArticleOperations } from '@/cms/articles/implement'
import { z } from 'zod'

const visibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: newsSchemas.params,
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

const read = defineOperation({
    authorizer: async ({ params, prisma }) => {
        const news = await prisma.newsArticle.findUniqueOrThrow({
            where: { id: params.id },
            include: {
                visibilityRegular: { include: visibilityIncluder },
                visibilityAdmin: { include: visibilityIncluder }
            }
        })
        return newsAuth.read({
            published: news.published,
            doubleLevelMatrix: {
                regularLevel: toMatrix(news.visibilityRegular),
                adminLevel: toMatrix(news.visibilityAdmin)
            }
        })
    },
    paramsSchema: newsSchemas.params,
    operation: async ({ prisma, params }) => {
        const news = await prisma.newsArticle.findUnique({
            where: {
                id: params.id
            },
            include: newsArticleRealtionsIncluder
        })
        if (!news) throw new ServiceError('NOT FOUND', `article ${params.id} not found`)
        return news
    }
})

export const newsOperations = {
    visibility,
    create: defineOperation({
        authorizer: () => newsAuth.create,
        dataSchema: newsSchemas.create,
        operation: async ({ prisma, data }) => {
            const { name, description, endDateTime } = data

            const backupEndDateTime = new Date()
            backupEndDateTime.setDate(backupEndDateTime.getDate() + defaultNewsArticleOldCutoff)

            assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.visibilityRegularRequirements },
                adminLevel: { requirements: data.visibilityAdminRequirements },
            })

            const article = await articleOperations.create.internalCall({
                data: { name },
                dataSchemaImplementationFields: { maxNameLength: 30 },
                operationImplementationFields: { special: null }
            })

            const visibilityRegular = await visibilityOperations.createWithRequirements.internalCall({
                data: { requirements: data.visibilityRegularRequirements },
            })
            const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                data: { requirements: data.visibilityAdminRequirements },
            })

            const news = await prisma.newsArticle.create({
                data: {
                    description,
                    article: {
                        connect: {
                            id: article.id
                        }
                    },
                    endDateTime: endDateTime || backupEndDateTime,
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
                include: newsArticleRealtionsIncluder,
            })
            return news
        }
    }),
    destroy: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.destroy.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
            }),
        paramsSchema: newsSchemas.params,
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            const news = await prisma.newsArticle.findUnique({ where: { id: params.id } })
            if (!news) throw new ServiceError('NOT FOUND', `article ${params.id} not found`)

            await prisma.$transaction(async tx => {
                await tx.newsArticle.delete({ where: { id: params.id } })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: news.visibilityAdminId },
                })
                await visibilityOperations.destroy.internalCall({
                    prisma: tx,
                    params: { visibilityId: news.visibilityRegularId },
                })
            })

            await articleOperations.destroy.internalCall({ params: { articleId: news.articleId } })
        }
    }),
    readCurrent: defineOperation({
        authorizer: () => newsAuth.readCurrent,
        operation: async ({ prisma }, prismaWhereFilter) => {
            const news = await prisma.newsArticle.findMany({
                where: {
                    endDateTime: {
                        gte: new Date(),
                    },
                    ...(prismaWhereFilter ? {
                        OR: [
                            { published: true, visibilityRegular: prismaWhereFilter },
                            { published: false, visibilityAdmin: prismaWhereFilter },
                        ]
                    } : {}),
                },
                orderBy: {
                    article: {
                        createdAt: 'desc',
                    },
                },
                include: simpleNewsArticleRealtionsIncluder,
            })
            return news.map(newsItem => ({
                ...newsItem,
                coverImage: newsItem.article.coverImage.image
            }))
        }
    }),
    readOldPage: defineOperation({
        paramsSchema: newsSchemas.readOldPage,
        authorizer: () => newsAuth.readOldPage,
        operation: async ({ prisma, params }, prismaWhereFilter) => {
            const news = await prisma.newsArticle.findMany({
                where: {
                    endDateTime: {
                        lt: new Date(),
                    },
                    ...(prismaWhereFilter ? {
                        OR: [
                            { published: true, visibilityRegular: prismaWhereFilter },
                            { published: false, visibilityAdmin: prismaWhereFilter },
                        ]
                    } : {}),
                },
                ...cursorPagingSelection(params.paging.page),
                orderBy: {
                    article: {
                        createdAt: 'desc',
                    }
                },
                include: simpleNewsArticleRealtionsIncluder
            })
            return news.map(newsItem => ({
                ...newsItem,
                coverImage: newsItem.article.coverImage.image
            }))
        }
    }),
    read,
    update: defineOperation({
        authorizer: async ({ params, prisma }) =>
            newsAuth.update.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma })
            }),
        paramsSchema: newsSchemas.params,
        dataSchema: newsSchemas.update,
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
        paramsSchema: newsSchemas.params,
        dataSchema: newsSchemas.setPublished,
        operation: async ({ prisma, params, data }) => {
            const previous = await prisma.newsArticle.findUniqueOrThrow({
                where: { id: params.id },
                select: { published: true },
            })
            const news = await prisma.newsArticle.update({
                where: { id: params.id },
                data: { published: data.published },
                include: simpleNewsArticleRealtionsIncluder,
            })

            if (data.published && !previous.published) {
                await notificationOperations.createSpecial.internalCall({
                    params: {
                        special: 'NEW_NEWS_ARTICLE',
                    },
                    data: {
                        title: 'Ny nyhetsartikkel', // TODO: Add info about the article
                        message: 'En ny nyhetsartikkel er publisert',
                        audience: { visibilityId: news.visibilityRegularId },
                    },
                })
            }

            return {
                ...news,
                coverImage: news.article.coverImage.image
            }
        }
    }),
    updateArticle: implementUpdateArticleOperations({
        implementationParamsSchema: z.object({
            newsId: z.number(),
        }),
        authorizer: async ({ implementationParams, prisma }) =>
            newsAuth.updateArticle.data({
                visibility: await visibility.readDoubleLevelMatrixInternal({
                    params: { id: implementationParams.newsId },
                    prisma
                })
            }),
        ownedArticles: async ({ implementationParams }) => {
            const news = await read({ params: { id: implementationParams.newsId }, bypassAuth: true })
            return [news.article]
        }
    })
} as const
