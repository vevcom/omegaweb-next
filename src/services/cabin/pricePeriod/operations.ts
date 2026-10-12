import '@pn-server-only'
import { cabinPricePeriodAuth } from './auth'
import { cabinPricePeriodParamsSchemas, cabinPricePeriodSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { ServiceError } from '@/services/error'

export const cabinPricePeriodOperations = {
    create: defineOperation({
        authorizer: () => cabinPricePeriodAuth.create,
        dataSchema: cabinPricePeriodSchemas.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => prisma.$transaction(async (tx) => {
            const currentReleaseDate = await cabinReleasePeriodOperations.getCurrentReleasePeriod({
                bypassAuth: true,
                prisma: tx,
            })

            if (currentReleaseDate && currentReleaseDate.releaseUntil >= data.validFrom) {
                throw new ServiceError(
                    'BAD DATA',
                    'Kan ikke sette en pris periode til å være gyldig når datoene allerede er sluppet.'
                )
            }

            const latestPricePeriod = await tx.pricePeriod.findFirst({
                orderBy: {
                    validFrom: 'desc',
                },
                take: 1,
            })

            if (latestPricePeriod && latestPricePeriod.validFrom >= data.validFrom) {
                throw new ServiceError('BAD DATA', 'Kan ikke sette en pris periode til å være gyldig før en annen periode.')
            }

            const result = await tx.pricePeriod.create({
                data: {
                    validFrom: data.validFrom
                }
            })

            if (data.copyPreviousPrices && latestPricePeriod) {
                const products = await tx.cabinProductPrice.findMany({
                    where: {
                        pricePeriodId: latestPricePeriod.id,
                    }
                })

                await tx.cabinProductPrice.createMany({
                    data: products.map(product => ({
                        ...product,
                        id: undefined,
                        pricePeriodId: result.id,
                    }))
                })
            }

            return result
        }),
    }),

    destroy: defineOperation({
        authorizer: () => cabinPricePeriodAuth.destroy,
        paramsSchema: cabinPricePeriodParamsSchemas.destroy,
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

    /**
     * Moves a price period that is not published. It stays after the released dates, as `create`
     * requires of a new one, and between its neighbours, so every day still falls in the period it
     * was priced by.
     */
    update: defineOperation({
        authorizer: () => cabinPricePeriodAuth.update,
        dataSchema: cabinPricePeriodSchemas.update,
        paramsSchema: cabinPricePeriodParamsSchemas.update,
        operation: async ({ prisma, data, params }) => {
            const currentReleasePeriod = await cabinReleasePeriodOperations.getCurrentReleasePeriod({ bypassAuth: true })

            const pricePeriod = await prisma.pricePeriod.findUniqueOrThrow({
                where: params,
            })

            if (currentReleasePeriod && pricePeriod.validFrom <= currentReleasePeriod.releaseUntil) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke endre en pris periode som er publisert.')
            }
            if (currentReleasePeriod && data.validFrom <= currentReleasePeriod.releaseUntil) {
                throw new ServiceError(
                    'BAD DATA',
                    'Kan ikke sette en pris periode til å være gyldig når datoene allerede er sluppet.'
                )
            }

            const [previous, next] = await Promise.all([
                prisma.pricePeriod.findFirst({
                    where: { id: { not: params.id }, validFrom: { lt: pricePeriod.validFrom } },
                    orderBy: { validFrom: 'desc' },
                }),
                prisma.pricePeriod.findFirst({
                    where: { id: { not: params.id }, validFrom: { gt: pricePeriod.validFrom } },
                    orderBy: { validFrom: 'asc' },
                }),
            ])

            if ((previous && previous.validFrom >= data.validFrom) || (next && next.validFrom <= data.validFrom)) {
                throw new ServiceError(
                    'BAD DATA',
                    'Pris perioden må starte etter perioden før den, og før perioden etter den.'
                )
            }

            return prisma.pricePeriod.update({
                where: params,
                data,
            })
        }
    }),
} as const
