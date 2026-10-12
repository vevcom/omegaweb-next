import '@pn-server-only'
import { cabinReleasePeriodAuth } from './auth'
import { cabinReleasePeriodParamsSchemas, cabinReleasePeriodSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'

export const cabinReleasePeriodOperations = {

    create: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.create,
        dataSchema: cabinReleasePeriodSchemas.create,
        operation: async ({ prisma, data }) => {
            const latestReleasePeriod = await prisma.releasePeriod.findFirst({
                orderBy: {
                    releaseTime: 'desc',
                },
            })

            if (latestReleasePeriod && latestReleasePeriod.releaseTime > data.releaseTime) {
                throw new ServiceError('BAD DATA', 'En ny slippdato må slippes senere den den gjeldene siste slippdatoen.')
            }

            if (latestReleasePeriod && latestReleasePeriod.releaseUntil >= data.releaseUntil) {
                throw new ServiceError('BAD DATA', 'Et nytt slipp, må slippe flere datoer enn det forrige slippet.')
            }

            await prisma.releasePeriod.create({
                data,
            })
        }
    }),

    destroy: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.destroy,
        paramsSchema: cabinReleasePeriodParamsSchemas.destroy,
        operation: async ({ prisma, params }) => {
            const releasePeriod = await prisma.releasePeriod.findUniqueOrThrow({
                where: params,
            })

            if (releasePeriod.releaseTime < new Date()) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke slette en slippgruppe som har blitt publisert.')
            }

            return await prisma.releasePeriod.delete({
                where: params,
            })
        }
    }),

    readMany: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.readMany,
        operation: async ({ prisma }) => prisma.releasePeriod.findMany({
            orderBy: {
                releaseUntil: 'desc',
            }
        })
    }),

    getCurrentReleasePeriod: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.getCurrentReleasePeriod,
        operation: async ({ prisma }) => prisma.releasePeriod.findFirst({
            where: {
                releaseTime: {
                    lte: new Date(),
                }
            },
            orderBy: {
                releaseUntil: 'desc',
            },
            take: 1
        })
    }),

    update: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.update,
        paramsSchema: cabinReleasePeriodParamsSchemas.update,
        dataSchema: cabinReleasePeriodSchemas.update,
        operation: async ({ prisma, params, data }) => prisma.releasePeriod.update({
            where: {
                id: params.id,
            },
            data,
        })
    }),
} as const
