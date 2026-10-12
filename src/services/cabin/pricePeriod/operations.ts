import '@pn-server-only'
import { cabinPricePeriodAuth } from './auth'
import { cabinPricePeriodSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { ServiceError } from '@/services/error'
import { z } from 'zod'

export const cabinPricePeriodOperations = {
    create: defineOperation({
        authorizer: () => cabinPricePeriodAuth.create,
        dataSchema: cabinPricePeriodSchemas.createPricePeriod,
        operation: async ({ prisma, data }) => {
            const currentReleaseDate = await cabinReleasePeriodOperations.getCurrentReleasePeriod({ bypassAuth: true })

            if (currentReleaseDate && currentReleaseDate.releaseUntil >= data.validFrom) {
                throw new ServiceError(
                    'BAD DATA',
                    'Kan ikke sette en pris periode til å være gyldig når datoene allerede er sluppet.'
                )
            }

            const latestPricePeriod = await prisma.pricePeriod.findFirst({
                orderBy: {
                    validFrom: 'desc',
                },
                take: 1,
            })

            if (latestPricePeriod && latestPricePeriod.validFrom >= data.validFrom) {
                throw new ServiceError('BAD DATA', 'Kan ikke sette en pris periode til å være gyldig før en annen periode.')
            }

            const result = await prisma.pricePeriod.create({
                data: {
                    validFrom: data.validFrom
                }
            })

            if (data.copyPreviousPrices && latestPricePeriod) {
                const products = await prisma.cabinProductPrice.findMany({
                    where: {
                        pricePeriodId: latestPricePeriod.id,
                    }
                })

                await prisma.cabinProductPrice.createMany({
                    data: products.map(product => ({
                        ...product,
                        id: undefined,
                        pricePeriodId: result.id,
                    }))
                })
            }

            return result
        }
    }),

    destroy: defineOperation({
        authorizer: () => cabinPricePeriodAuth.destroy,
        paramsSchema: z.object({
            id: z.number(),
        }),
        operation: async ({ prisma, params }) => {
            const currentReleasePeriod = await cabinReleasePeriodOperations.getCurrentReleasePeriod({ bypassAuth: true })

            const pricePeriod = await prisma.pricePeriod.findUniqueOrThrow({
                where: params,
            })

            if (currentReleasePeriod && pricePeriod.validFrom <= currentReleasePeriod.releaseUntil) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke slette en pris periode som er publisert.')
            }

            return await prisma.pricePeriod.delete({
                where: params,
            })
        }
    }),

    readMany: defineOperation({
        authorizer: () => cabinPricePeriodAuth.readMany,
        operation: async ({ prisma }) => prisma.pricePeriod.findMany()
    }),

    readPublicPeriods: defineOperation({
        authorizer: () => cabinPricePeriodAuth.readPublicPeriods,
        operation: async ({ prisma }) => {
            const releaseDate = await cabinReleasePeriodOperations.getCurrentReleasePeriod({ bypassAuth: true })

            const [currentPeriod, futurePeriods] = await Promise.all([
                prisma.pricePeriod.findFirstOrThrow({
                    where: {
                        validFrom: {
                            lte: new Date(),
                        },
                    },
                    orderBy: {
                        validFrom: 'desc',
                    },
                    take: 1,
                }),
                prisma.pricePeriod.findMany({
                    where: {
                        validFrom: {
                            gt: new Date(),
                            ...(releaseDate ? {
                                lt: releaseDate.releaseUntil,
                            } : {})
                        }
                    }
                })
            ])

            return [currentPeriod, ...futurePeriods]
        }
    }),

    readUnreleasedPeriods: defineOperation({
        authorizer: () => cabinPricePeriodAuth.readUnreleasedPeriods,
        operation: async ({ prisma }) => {
            const releaseDate = await cabinReleasePeriodOperations.getCurrentReleasePeriod({ bypassAuth: true })
            return prisma.pricePeriod.findMany({
                where: {
                    validFrom: {
                        gte: releaseDate?.releaseUntil,
                    }
                }
            })
        }
    }),

    update: defineOperation({
        authorizer: () => cabinPricePeriodAuth.update,
        dataSchema: cabinPricePeriodSchemas.updatePricePeriod,
        paramsSchema: z.object({
            pricePeriodId: z.number(),
        }),
        operation: async ({ prisma, data, params }) => prisma.pricePeriod.update({
            where: {
                id: params.pricePeriodId,
            },
            data,
        })
    }),
} as const
