import '@pn-server-only'
import { revueAuth } from './auth'
import { revueCardIncluder, revueExpandedIncluder } from './constants'
import { revueSchemas } from './schemas'
import { destroyRevueGroups } from './groups/destroyGroups'
import { articleRelationsIncluder } from '@/cms/articles/constants'
import { implementUpdateArticleOperations } from '@/cms/articles/implement'
import { articleOperations } from '@/cms/articles/operations'
import { defineOperation } from '@/services/serviceOperation'

export const revueOperations = {
    create: defineOperation({
        dataSchema: revueSchemas.data.create,
        authorizer: () => revueAuth.create,
        opensTransaction: true,
        operation: ({ prisma, data }) => prisma.$transaction(async tx => {
            const article = await articleOperations.create.internalCall({
                prisma: tx,
                data: { name: data.name },
                dataSchemaImplementationFields: { maxNameLength: 30 },
                operationImplementationFields: { special: null },
            })
            return tx.revue.create({ data: { ...data, articleId: article.id } })
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
        opensTransaction: true,
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            const revue = await tx.revue.update({ where: { id: params.revueId }, data })
            if (data.name !== undefined) {
                await articleOperations.update.internalCall({
                    prisma: tx,
                    params: { articleId: revue.articleId },
                    data: { name: data.name },
                })
            }
            return revue
        }),
    }),

    destroy: defineOperation({
        paramsSchema: revueSchemas.params.destroy,
        authorizer: () => revueAuth.destroy,
        opensTransaction: true,
        operation: ({ prisma, params }) => prisma.$transaction(async tx => {
            await destroyRevueGroups(tx, { revueId: params.revueId })
            const revue = await tx.revue.delete({ where: { id: params.revueId } })
            await articleOperations.destroy.internalCall({ prisma: tx, params: { articleId: revue.articleId } })
        }),
    }),

    updateArticle: implementUpdateArticleOperations({
        implementationParamsSchema: revueSchemas.params.updateArticle,
        authorizer: () => revueAuth.updateArticle,
        ownedArticles: async ({ prisma, implementationParams }) => [
            (await prisma.revue.findUniqueOrThrow({
                where: { id: implementationParams.revueId },
                select: { article: { include: articleRelationsIncluder } },
            })).article,
        ],
    }),
} as const
