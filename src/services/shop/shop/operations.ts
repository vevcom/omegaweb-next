import '@pn-server-only'
import { shopParamsSchemas, shopSchemas } from './schemas'
import { shopAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
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
        paramsSchema: shopParamsSchemas.read,
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
                    ledgerAccount: { select: { id: true, name: true } },
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

    /**
     * Links a shop to the GROUP ledger account its purchases are credited to, replacing any
     * earlier link.
     * @param params.shopId - The shop to link
     * @param data.ledgerAccountId - The account to credit
     */
    connectToLedger: defineOperation({
        authorizer: async ({ data, prisma }) => shopAuth.connectToLedger.data({
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: data.ledgerAccountId })],
        }),
        paramsSchema: shopParamsSchemas.connectToLedger,
        dataSchema: shopSchemas.connectToLedger,
        operation: async ({ prisma, params, data }) => {
            const account = await prisma.ledgerAccount.findUniqueOrThrow({
                where: { id: data.ledgerAccountId },
                select: { type: true },
            })
            if (account.type !== 'GROUP') {
                throw new ServiceError('BAD PARAMETERS', 'En butikk kan bare knyttes til en gruppekonto.')
            }

            return prisma.shop.update({
                where: { id: params.shopId },
                data: { ledgerAccountId: data.ledgerAccountId },
            })
        },
    }),
} as const

