import '@pn-server-only'

import { cabinProductAuth } from './auth'
import { cabinProductSchemas } from './schemas'
import { cabinProductPriceIncluder } from './constants'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'

export const cabinProductOperations = {

    create: defineOperation({
        authorizer: () => cabinProductAuth.create,
        dataSchema: cabinProductSchemas.data.create,
        operation: ({ prisma, data }) => prisma.cabinProduct.create({
            data,
        })
    }),

    createPrice: defineOperation({
        authorizer: () => cabinProductAuth.createPrice,
        paramsSchema: cabinProductSchemas.params.createPrice,
        dataSchema: cabinProductSchemas.data.createPrice,
        operation: async ({ prisma, params, data }) => {
            const [pricePeriod, releasePeriod] = await Promise.all([
                prisma.pricePeriod.findUniqueOrThrow({
                    where: {
                        id: data.pricePeriodId,
                    }
                }),
                cabinReleasePeriodOperations.getCurrentReleasePeriod({ bypassAuth: true })
            ])

            if (releasePeriod && pricePeriod.validFrom <= releasePeriod.releaseUntil) {
                throw new ServiceError('BAD PARAMETERS', 'Kan ikke endre prisene på et produkt som er sluppet')
            }

            const result = await prisma.cabinProductPrice.create({
                data: {
                    ...data,
                    cabinProductId: params.cabinProductId,
                }
            })

            return result
        }
    }),

    readMany: defineOperation({
        authorizer: () => cabinProductAuth.readMany,
        operation: ({ prisma }) => prisma.cabinProduct.findMany({
            include: cabinProductPriceIncluder,
        }),
    }),

    readActive: defineOperation({
        authorizer: () => cabinProductAuth.readActive,
        operation: async ({ prisma }) => {
            const pricePeriods = await cabinPricePeriodOperations.readPublicPeriods({ bypassAuth: true })

            return await prisma.cabinProduct.findMany({
                where: {
                    CabinProductPrice: {
                        some: {
                            pricePeriodId: {
                                in: pricePeriods.map(period => period.id)
                            }
                        }
                    }
                },
                include: cabinProductPriceIncluder,
            })
        },
    }),

    read: defineOperation({
        authorizer: () => cabinProductAuth.read,
        paramsSchema: cabinProductSchemas.params.read,
        operation: ({ prisma, params }) => prisma.cabinProduct.findUniqueOrThrow({
            where: params,
            include: cabinProductPriceIncluder,
        })
    }),
} as const
