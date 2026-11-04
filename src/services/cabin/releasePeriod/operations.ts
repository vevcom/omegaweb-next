import '@pn-server-only'
import { cabinReleasePeriodAuth } from './auth'
import { cabinReleasePeriodSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'

export const cabinReleasePeriodOperations = {

    create: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.create,
        dataSchema: cabinReleasePeriodSchemas.data.create,
        operation: async ({ prisma, data }) => {
            const latestReleasePeriod = await prisma.releasePeriod.findFirst({
                orderBy: {
                    releaseTime: 'desc',
                },
            })

            if (latestReleasePeriod && latestReleasePeriod.releaseTime > data.releaseTime) {
                throw new ServiceError('BAD DATA', 'En ny slippdato må være senere enn den gjeldende siste slippdatoen.')
            }

            if (latestReleasePeriod && latestReleasePeriod.releaseUntil >= data.releaseUntil) {
                throw new ServiceError('BAD DATA', 'Et nytt slipp må slippe flere datoer enn det forrige slippet.')
            }

            return prisma.releasePeriod.create({
                data,
            })
        }
    }),

    destroy: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.destroy,
        paramsSchema: cabinReleasePeriodSchemas.params.destroy,
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

    /**
     * Changes a release that has not happened yet. The releases stay in order: each one releases
     * later, and further, than the one before it, as `create` requires of a new one.
     */
    update: defineOperation({
        authorizer: () => cabinReleasePeriodAuth.update,
        paramsSchema: cabinReleasePeriodSchemas.params.update,
        dataSchema: cabinReleasePeriodSchemas.data.update,
        operation: async ({ prisma, params, data }) => {
            const releasePeriod = await prisma.releasePeriod.findUniqueOrThrow({
                where: params,
            })

            if (releasePeriod.releaseTime < new Date()) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke endre en slippgruppe som har blitt publisert.')
            }

            const [previous, next] = await Promise.all([
                prisma.releasePeriod.findFirst({
                    where: { id: { not: params.id }, releaseTime: { lte: releasePeriod.releaseTime } },
                    orderBy: { releaseTime: 'desc' },
                }),
                prisma.releasePeriod.findFirst({
                    where: { id: { not: params.id }, releaseTime: { gt: releasePeriod.releaseTime } },
                    orderBy: { releaseTime: 'asc' },
                }),
            ])

            if (previous && (previous.releaseTime > data.releaseTime || previous.releaseUntil >= data.releaseUntil)) {
                throw new ServiceError('BAD DATA', 'Slippet må slippes etter, og slippe flere datoer enn, slippet før det.')
            }
            if (next && (next.releaseTime < data.releaseTime || next.releaseUntil <= data.releaseUntil)) {
                throw new ServiceError('BAD DATA', 'Slippet må slippes før, og slippe færre datoer enn, slippet etter det.')
            }

            return prisma.releasePeriod.update({
                where: params,
                data,
            })
        }
    }),
} as const
