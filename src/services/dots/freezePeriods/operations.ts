import '@pn-server-only'
import { dotFreezePeriodAuth } from './auth'
import { dotFreezePeriodSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'

export const dotFreezePeriodOperations = {
    create: defineOperation({
        dataSchema: dotFreezePeriodSchemas.data.create,
        authorizer: () => dotFreezePeriodAuth.create,
        operation: async ({ prisma, data }) => prisma.dotFreezePeriod.create({ data }),
    }),

    readAll: defineOperation({
        authorizer: () => dotFreezePeriodAuth.readAll,
        operation: async ({ prisma }) => prisma.dotFreezePeriod.findMany({
            orderBy: {
                start: 'desc',
            },
        }),
    }),

    update: defineOperation({
        paramsSchema: dotFreezePeriodSchemas.params.update,
        dataSchema: dotFreezePeriodSchemas.data.update,
        authorizer: () => dotFreezePeriodAuth.update,
        operation: async ({ prisma, params, data }) => prisma.dotFreezePeriod.update({
            where: {
                id: params.id,
            },
            data,
        }),
    }),

    destroy: defineOperation({
        paramsSchema: dotFreezePeriodSchemas.params.destroy,
        authorizer: () => dotFreezePeriodAuth.destroy,
        operation: async ({ prisma, params }) => prisma.dotFreezePeriod.delete({
            where: {
                id: params.id,
            },
        }),
    }),
} as const
