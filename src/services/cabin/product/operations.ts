import '@pn-server-only'

import { cabinProductAuth } from './auth'
import { cabinProductSchemas } from './schemas'
import { cabinProductPriceIncluder } from './constants'
import { cabinReleasePeriodOperations } from '@/services/cabin/releasePeriod/operations'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { cabinPricePeriodOperations } from '@/services/cabin/pricePeriod/operations'
import { z } from 'zod'

export const cabinProductOperations = {

    create: defineOperation({
        authorizer: () => cabinProductAuth.create,
        dataSchema: cabinProductSchemas.createProduct,
        operation: ({ prisma, data }) => prisma.cabinProduct.create({
            data,
        })
    }),

    createPrice: defineOperation({
        authorizer: () => cabinProductAuth.createPrice,
        paramsSchema: z.object({
            cabinProductId: z.number(),
        }),
        dataSchema: cabinProductSchemas.createProductPrice,
        operation: async ({ prisma, params, data, session }) => {
            const [pricePeriod, releasePeriod] = await Promise.all([
                prisma.pricePeriod.findUniqueOrThrow({
                    where: {
                        id: data.pricePeriodId,
                    }
                }),
                cabinReleasePeriodOperations.getCurrentReleasePeriod({
                    bypassAuth: true,
                    session
                })
            ])

            if (releasePeriod && pricePeriod.validFrom <= releasePeriod.releaseUntil) {
                throw new ServiceError('BAD PARAMETERS', 'Cannot change prices for a product that is released')
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
        paramsSchema: z.object({
            id: z.number(),
        }),
        operation: ({ prisma, params }) => prisma.cabinProduct.findUniqueOrThrow({
            where: params,
            include: cabinProductPriceIncluder,
        })
    }),
} as const
