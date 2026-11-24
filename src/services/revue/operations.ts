import '@ow-server-only'
import { revueAuth } from './auth'
import { revueCardIncluder, revueExpandedIncluder } from './constants'
import { revueSchemas } from './schemas'
import { revueGroupOperations } from './groups/operations'
import { articleRelationsIncluder } from '@/cms/articles/constants'
import { implementArticleOperations } from '@/cms/articles/implement'
import { defineOperation } from '@/services/serviceOperation'

const article = implementArticleOperations({
    maxNameLength: 30,
    implementationParamsSchema: revueSchemas.params.article,
    authorizer: () => revueAuth.updateArticle,
    ownedArticles: async ({ prisma, implementationParams }) => [
        (await prisma.revue.findUniqueOrThrow({
            where: { id: implementationParams.revueId },
            select: { article: { include: articleRelationsIncluder } },
        })).article,
    ],
})

export const revueOperations = {
    /** Makes a revue, with the groups given put in it at their orders. */
    create: defineOperation({
        dataSchema: revueSchemas.data.create,
        authorizer: () => revueAuth.create,
        transaction: 'OPENS',
        operation: ({ prisma, data: { name, groups = [], ...revueData } }) => prisma.$transaction(async tx => {
            const createdArticle = await article.internal.create.internalCall({
                prisma: tx,
                data: { name },
            })
            const revue = await tx.revue.create({
                data: { ...revueData, articleId: createdArticle.id, name: createdArticle.name },
            })
            for (const group of groups) {
                await revueGroupOperations.internal.addToRevue.internalCall({
                    prisma: tx,
                    params: { revueId: revue.id },
                    data: group,
                })
            }
            return revue
        }),
    }),

    /** The newest revue comes first, which is the most current one. */
    readMany: defineOperation({
        authorizer: () => revueAuth.readMany,
        operation: ({ prisma }) => prisma.revue.findMany({
            include: revueCardIncluder,
            orderBy: { year: 'desc' },
        }),
    }),

    read: defineOperation({
        paramsSchema: revueSchemas.params.read,
        authorizer: () => revueAuth.read,
        operation: ({ prisma, params }) => prisma.revue.findUniqueOrThrow({
            where: { year: params.year },
            include: revueExpandedIncluder,
        }),
    }),

    update: defineOperation({
        paramsSchema: revueSchemas.params.update,
        dataSchema: revueSchemas.data.update,
        authorizer: () => revueAuth.update,
        transaction: 'OPENS',
        operation: ({ prisma, params, data: { name, ...revueData } }) => prisma.$transaction(async tx => {
            if (name !== undefined) {
                // The revue's name is its article's, and follows it.
                const { articleId } = await tx.revue.findUniqueOrThrow({
                    where: { id: params.revueId },
                    select: { articleId: true },
                })
                await article.internal.update.internalCall({ prisma: tx, params: { articleId }, data: { name } })
            }
            return tx.revue.update({ where: { id: params.revueId }, data: revueData })
        }),
    }),

    destroy: defineOperation({
        paramsSchema: revueSchemas.params.destroy,
        authorizer: () => revueAuth.destroy,
        transaction: 'OPENS',
        operation: ({ prisma, params }) => prisma.$transaction(async tx => {
            const revue = await tx.revue.delete({ where: { id: params.revueId } })
            await article.internal.destroy.internalCall({ prisma: tx, params: { articleId: revue.articleId } })
        }),
    }),

    article,
} as const
