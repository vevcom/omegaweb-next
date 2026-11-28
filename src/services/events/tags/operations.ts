import '@ow-server-only'
import { eventTagAuth } from './auth'
import { specialEventTags } from './constants'
import { eventTagSchemas } from './schemas'
import logger from '@/lib/logger'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'

const createSpecial = defineSubOperation({
    paramsSchema: () => eventTagSchemas.params.readSpecial,
    read: false,
    operation: () => ({ prisma, params: { special } }) => prisma.eventTag.create({
        data: {
            special,
            ...specialEventTags[special]
        }
    })
})

export const eventTagOperations = {
    read: defineOperation({
        paramsSchema: eventTagSchemas.params.read,
        authorizer: () => eventTagAuth.read,
        read: true,
        operation: async ({ prisma, params: { id } }) => await prisma.eventTag.findUniqueOrThrow({
            where: {
                id
            }
        })
    }),
    readSpecial: defineOperation({
        paramsSchema: eventTagSchemas.params.readSpecial,
        authorizer: () => eventTagAuth.readSpecial,
        read: true,
        operation: async ({ prisma, params: { special } }) => {
            const tag = await prisma.eventTag.findUnique({
                where: {
                    special
                }
            })
            if (!tag) {
                logger.error(`Special event tag ${special} not found - creating it`)
                return await createSpecial.internalCall({ prisma, params: { special } })
            }
            return tag
        }
    }),
    readAll: defineOperation({
        authorizer: () => eventTagAuth.readAll,
        read: true,
        operation: async ({ prisma }) => await prisma.eventTag.findMany()
    }),
    create: defineOperation({
        dataSchema: eventTagSchemas.data.create,
        authorizer: () => eventTagAuth.create,
        read: false,
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
        read: false,
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
        read: false,
        operation: async ({ prisma, params }) => {
            const tag = await prisma.eventTag.findUniqueOrThrow({
                where: { id: params.id }
            })
            if (tag.special) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke slette spesialtagger')
            }
            await prisma.eventTag.delete({
                where: { id: params.id }
            })
        }
    }),
} as const
