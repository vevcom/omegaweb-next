import '@pn-server-only'
import { shopSchemas } from './schemas'
import { shopAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'
import type { ExtendedShop } from './types'

export const shopOperations = {
    create: defineOperation({
        dataSchema: shopSchemas.create,
        authorizer: () => shopAuth.create,
        operation: async ({ prisma, data }) => prisma.shop.create({
            data
        })
    }),

    readMany: defineOperation({
        authorizer: () => shopAuth.read,
        operation: ({ prisma }) => prisma.shop.findMany(),
    }),

    read: defineOperation({
        authorizer: () => shopAuth.read,
        paramsSchema: z.object({
            shopId: z.number(),
        }),
        operation: async ({ prisma, params }): Promise<ExtendedShop | null> => {
            const results = await prisma.shop.findFirst({
                where: {
                    id: params.shopId
                },
                include: {
                    ShopProduct: {
                        include: {
                            product: true,
                        },
                    },
                },
            })
            if (results === null) return null

            const ret: ExtendedShop = {
                ...results,
                products: []
            }
            Reflect.deleteProperty(ret, 'ShopProduct')
            ret.products = results.ShopProduct.map(shopProduct => ({
                price: shopProduct.price,
                active: shopProduct.active,
                ...shopProduct.product,
            }))

            return ret
        }
    }),

    connectToLedger: defineOperation({
        authorizer: () => shopAuth.connectToLedger,
        paramsSchema: z.object({
            ledgerId: z.number().int(),
            shopId: z.number().int()
        }),
        operation: async ({ prisma, params }) =>
            await prisma.ledgerAccount.update({
                where: {
                    id: params.ledgerId,
                    type: 'GROUP',
                },
                data: {
                    shop: {
                        connect: {
                            id: params.shopId
                        }
                    }
                }
            })
    })
} as const

