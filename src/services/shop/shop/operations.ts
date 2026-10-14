import '@pn-server-only'
import { shopSchemas } from './schemas'
import { shopAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { visibilityOperations } from '@/services/visibility/operations'
import {
    assertAdminLevelIsSubOfRegularLevel,
    implementDoubleLevelVisibilityOperations,
} from '@/services/visibility/implement'
import type { ExtendedShop } from './types'

const visibility = implementDoubleLevelVisibilityOperations({
    implementationParamsSchema: shopSchemas.params.visibility,
    authorizers: {
        readDoubleLevelMatrix: ({ doubleLevelMatrix }) =>
            shopAuth.readDoubleLevelMatrix.data({ visibility: doubleLevelMatrix }),
        updateRegularLevel: ({ doubleLevelMatrix }) =>
            shopAuth.updateRegularLevel.data({ visibility: doubleLevelMatrix }),
        updateAdminLevel: ({ doubleLevelMatrix }) =>
            shopAuth.updateAdminLevel.data({ visibility: doubleLevelMatrix }),
    },
    readDoubleLevel: async ({ prisma, implementationParams, include }) => {
        const shop = await prisma.shop.findUniqueOrThrow({
            where: { id: implementationParams.shopId },
            include: {
                visibilityRegular: { include },
                visibilityAdmin: { include },
            },
        })
        return {
            regularLevel: shop.visibilityRegular,
            adminLevel: shop.visibilityAdmin,
        }
    },
})

export const shopOperations = {
    visibility,

    create: defineOperation({
        dataSchema: shopSchemas.data.create,
        authorizer: () => shopAuth.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            assertAdminLevelIsSubOfRegularLevel({
                regularLevel: { requirements: data.visibilityRegularRequirements },
                adminLevel: { requirements: data.visibilityAdminRequirements },
            })

            return prisma.$transaction(async tx => {
                const visibilityRegular = await visibilityOperations.createWithRequirements.internalCall({
                    prisma: tx,
                    data: { requirements: data.visibilityRegularRequirements },
                })
                const visibilityAdmin = await visibilityOperations.createWithRequirements.internalCall({
                    prisma: tx,
                    data: { requirements: data.visibilityAdminRequirements },
                })

                return tx.shop.create({
                    data: {
                        name: data.name,
                        description: data.description,
                        visibilityRegular: { connect: { id: visibilityRegular.id } },
                        visibilityAdmin: { connect: { id: visibilityAdmin.id } },
                    },
                })
            })
        },
    }),

    readMany: defineOperation({
        authorizer: () => shopAuth.readMany,
        operation: ({ prisma }, prismaWhereFilter) => prisma.shop.findMany({
            // No filter means the session bypasses the regular level with SHOP_ADMIN.
            where: prismaWhereFilter ? { visibilityRegular: prismaWhereFilter } : undefined,
        }),
    }),

    /**
     * Returns the shop with its products and both of its visibility levels, so its pages can
     * decide which controls to show.
     */
    read: defineOperation({
        authorizer: async ({ params, prisma }) => shopAuth.read.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: shopSchemas.params.read,
        operation: async ({ prisma, params }): Promise<ExtendedShop> => {
            const { ShopProduct, ...shop } = await prisma.shop.findUniqueOrThrow({
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

            return {
                ...shop,
                products: ShopProduct.map(shopProduct => ({
                    price: shopProduct.price,
                    active: shopProduct.active,
                    ...shopProduct.product,
                })),
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
            }
        }
    }),

    /**
     * Links a shop to the GROUP ledger account its purchases are credited to, replacing any
     * earlier link.
     * @param params.shopId - The shop to link
     * @param data.ledgerAccountId - The account to credit
     */
    connectToLedger: defineOperation({
        authorizer: async ({ params, data, prisma }) => shopAuth.connectToLedger.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: data.ledgerAccountId })],
        }),
        paramsSchema: shopSchemas.params.connectToLedger,
        dataSchema: shopSchemas.data.connectToLedger,
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
