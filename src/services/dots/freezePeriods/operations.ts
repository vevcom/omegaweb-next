import '@ow-server-only'
import { dotFreezePeriodContract } from './contract'
import { defineOperation } from '@/services/serviceOperation'

export const dotFreezePeriodOperations = {
    create: defineOperation(dotFreezePeriodContract.create, {
        operation: async ({ prisma, data }) => prisma.dotFreezePeriod.create({ data }),
    }),

    readAll: defineOperation(dotFreezePeriodContract.readAll, {
        operation: async ({ prisma }) => prisma.dotFreezePeriod.findMany({
            orderBy: {
                start: 'desc',
            },
        }),
    }),

    update: defineOperation(dotFreezePeriodContract.update, {
        operation: async ({ prisma, params, data }) => prisma.dotFreezePeriod.update({
            where: {
                id: params.id,
            },
            data,
        }),
    }),

    destroy: defineOperation(dotFreezePeriodContract.destroy, {
        operation: async ({ prisma, params }) => prisma.dotFreezePeriod.delete({
            where: {
                id: params.id,
            },
        }),
    }),
} as const
