import '@pn-server-only'
import { eventTagAuth } from './auth'
import { specialEventTags } from './constants'
import { eventTagSchemas } from './schemas'
import logger from '@/lib/logger'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { SpecialEventTags } from '@/prisma-generated-pn-types'
import { z } from 'zod'

export const eventTagOperations = {
    read: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        authorizer: () => eventTagAuth.read,
        operation: async ({ prisma, params: { id } }) => await prisma.eventTag.findUniqueOrThrow({
            where: {
                id
            }
        })
    }),
    readSpecial: defineOperation({
        paramsSchema: z.object({
            special: z.nativeEnum(SpecialEventTags),
        }),
        authorizer: () => eventTagAuth.readSpecial,
        operation: async ({ prisma, params: { special } }) => {
            const tag = await prisma.eventTag.findUnique({
                where: {
                    special
                }
            })
            if (!tag) {
                logger.error(`Special event tag ${special} not found - creating it`)
                return await prisma.eventTag.create({
                    data: {
                        special,
                        ...specialEventTags[special]
                    }
                })
            }
            return tag
        }
    }),
    readAll: defineOperation({
        authorizer: () => eventTagAuth.readAll,
        operation: async ({ prisma }) => await prisma.eventTag.findMany()
    }),
    create: defineOperation({
        dataSchema: eventTagSchemas.create,
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
        paramsSchema: z.object({
            id: z.number(),
        }),
        dataSchema: eventTagSchemas.update,
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
        paramsSchema: z.object({
            id: z.number(),
        }),
        authorizer: () => eventTagAuth.destroy,
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
