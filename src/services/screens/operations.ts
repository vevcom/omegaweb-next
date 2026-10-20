import '@pn-server-only'
import { screenAuth } from './auth'
import { screenIncluder } from './constants'
import { screenSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import type { ExpandedScreen } from './types'

export const screenOperations = {
    create: defineOperation({
        dataSchema: screenSchemas.data.create,
        authorizer: () => screenAuth.create,
        operation: ({ prisma, data }) => prisma.screen.create({ data }),
    }),

    /** Reads a screen by its name, which is how a display asks for it, with its pages in order. */
    read: defineOperation({
        paramsSchema: screenSchemas.params.read,
        authorizer: () => screenAuth.read,
        operation: async ({ prisma, params }): Promise<ExpandedScreen> => {
            const { pages, ...screen } = await prisma.screen.findUniqueOrThrow({
                where: { name: params.name },
                include: screenIncluder,
            })
            return { ...screen, pages: pages.map(({ screenPage }) => screenPage) }
        },
    }),

    readMany: defineOperation({
        authorizer: () => screenAuth.readMany,
        operation: ({ prisma }) => prisma.screen.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { pages: true } } },
        }),
    }),

    update: defineOperation({
        paramsSchema: screenSchemas.params.update,
        dataSchema: screenSchemas.data.update,
        authorizer: () => screenAuth.update,
        operation: ({ prisma, params, data }) => prisma.screen.update({
            where: { id: params.id },
            data,
        }),
    }),

    /**
     * Sets which pages the screen shows and in what order, replacing what it showed before. Adding,
     * removing and moving pages are all this one write, so the order never has gaps or clashes.
     */
    updatePages: defineOperation({
        paramsSchema: screenSchemas.params.updatePages,
        dataSchema: screenSchemas.data.updatePages,
        authorizer: () => screenAuth.updatePages,
        opensTransaction: true,
        operation: ({ prisma, params, data }) => prisma.$transaction(async tx => {
            // Touching the screen row first locks it, so two concurrent updates of the same screen
            // run one after the other instead of clashing on the order. It also fails with NOT FOUND
            // for a screen that does not exist.
            await tx.screen.update({ where: { id: params.id }, data: { updatedAt: new Date() } })

            const foundPages = await tx.screenPage.count({ where: { id: { in: data.pageIds } } })
            if (foundPages !== data.pageIds.length) {
                throw new ServiceError('NOT FOUND', 'Fant ikke alle sidene.')
            }

            await tx.screenPageScreen.deleteMany({ where: { screenId: params.id } })
            await tx.screenPageScreen.createMany({
                data: data.pageIds.map((screenPageId, order) => ({ screenId: params.id, screenPageId, order })),
            })
        }),
    }),

    /** Destroys a screen. Its pages stay, since other screens may show them. */
    destroy: defineOperation({
        paramsSchema: screenSchemas.params.destroy,
        authorizer: () => screenAuth.destroy,
        operation: async ({ prisma, params }) => {
            await prisma.screen.delete({ where: { id: params.id } })
        },
    }),
} as const
