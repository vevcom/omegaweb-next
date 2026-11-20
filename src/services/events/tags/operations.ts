import '@ow-server-only'
import { eventTagAuth } from './auth'
import { eventTagSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'

export const eventTagOperations = {
    read: defineOperation({
        paramsSchema: eventTagSchemas.params.read,
        authorizer: () => eventTagAuth.read,
        operation: async ({ prisma, params: { id } }) => await prisma.eventTag.findUniqueOrThrow({
            where: {
                id
            }
        })
    }),
    readAll: defineOperation({
        authorizer: () => eventTagAuth.readAll,
        operation: async ({ prisma }) => await prisma.eventTag.findMany()
    }),
    create: defineOperation({
        dataSchema: eventTagSchemas.data.create,
        authorizer: () => eventTagAuth.create,
        operation: async ({ prisma, data: { color, ...data } }) =>
            await prisma.eventTag.create({
                data: {
                    ...data,
                    colorR: color.red,
                    colorG: color.green,
                    colorB: color.blue
                }
            })
    }),
    update: defineOperation({
        paramsSchema: eventTagSchemas.params.update,
        dataSchema: eventTagSchemas.data.update,
        authorizer: () => eventTagAuth.update,
        operation: async ({ prisma, params: { id }, data: { color, ...data } }) => {
            const colorR = color ? color.red : undefined
            const colorG = color ? color.green : undefined
            const colorB = color ? color.blue : undefined
            return await prisma.eventTag.update({
                where: {
                    id
                },
                data: {
                    ...data,
                    colorR,
                    colorG,
                    colorB,
                }
            })
        }
    }),
    destroy: defineOperation({
        paramsSchema: eventTagSchemas.params.destroy,
        authorizer: () => eventTagAuth.destroy,
        operation: async ({ prisma, params }) => {
            await prisma.eventTag.delete({
                where: { id: params.id }
            })
        }
    }),
} as const
