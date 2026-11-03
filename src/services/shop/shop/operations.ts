import '@pn-server-only'
import { shopSchemas } from './schemas'
import { shopAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { resolveAccountOwnership } from '@/services/ledger/accounts/ownership'
import { cmsImageOperations } from '@/cms/images/operations'
import { productImageIncluder } from '@/services/shop/product/constants'
import { visibilityOperations } from '@/services/visibility/operations'
import { implementDoubleLevelVisibilityOperations } from '@/services/visibility/implement'
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
        operation: async ({ prisma, data }) => prisma.$transaction(async tx => {
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
        }),
    }),

    readMany: defineOperation({
        authorizer: () => shopAuth.readMany,
        operation: ({ prisma }, prismaWhereFilter) => prisma.shop.findMany({ where: prismaWhereFilter }),
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
                            product: {
                                include: {
                                    ...productImageIncluder,
                                    _count: { select: { ShopProduct: true } },
                                },
                            },
                        },
                    },
                    ledgerAccount: { select: { id: true, name: true } },
                },
            })

            return {
                ...shop,
                products: ShopProduct.map(({ price, active, product: { _count, ...product } }) => ({
                    price,
                    active,
                    ...product,
                    soldElsewhere: _count.ShopProduct > 1,
                })),
                visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
            }
        }
    }),

    /**
     * Renames or re-describes a shop. Its visibility and the account it pays into have operations
     * of their own.
     */
    update: defineOperation({
        authorizer: async ({ params, prisma }) => shopAuth.update.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: shopSchemas.params.update,
        dataSchema: shopSchemas.data.update,
        operation: async ({ prisma, params, data }) => prisma.shop.update({
            where: { id: params.shopId },
            data: {
                name: data.name,
                description: data.description,
            },
        }),
    }),

    /**
     * Links a shop to the GROUP ledger account its purchases are credited to, replacing any
     * earlier link.
     * @param params.shopId - The shop to link
     * @param data.ledgerAccountId - The account to credit
     */
    connectToLedgerAccount: defineOperation({
        authorizer: async ({ params, data, prisma }) => shopAuth.connectToLedgerAccount.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
            accounts: [await resolveAccountOwnership(prisma, { ledgerAccountId: data.ledgerAccountId })],
        }),
        paramsSchema: shopSchemas.params.connectToLedgerAccount,
        dataSchema: shopSchemas.data.connectToLedgerAccount,
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

    /**
     * Creates a product and puts it on sale in the shop in the same write. The price it is sold
     * for becomes the product's suggested price, for the next shop to connect it.
     */
    createProduct: defineOperation({
        authorizer: async ({ params, prisma }) => shopAuth.createProduct.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: shopSchemas.params.createProduct,
        dataSchema: shopSchemas.data.createProduct,
        opensTransaction: true,
        operation: async ({ prisma, params, data: { price, ...product } }) => prisma.$transaction(async tx => {
            const image = await cmsImageOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })
            return tx.product.create({
                data: {
                    ...product,
                    suggestedPrice: price,
                    image: { connect: { id: image.id } },
                    ShopProduct: {
                        create: { price, shopId: params.shopId },
                    },
                },
            })
        }),
    }),

    /**
     * Puts a product that already exists on sale in the shop, at the given price or, without
     * one, at the product's suggested price.
     */
    connectProduct: defineOperation({
        authorizer: async ({ params, prisma }) => shopAuth.connectProduct.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: shopSchemas.params.connectProduct,
        dataSchema: shopSchemas.data.connectProduct,
        operation: async ({ prisma, params, data }) => {
            const product = await prisma.product.findUniqueOrThrow({
                where: { id: data.productId },
                select: { suggestedPrice: true },
            })
            const price = data.optionalPrice ?? product.suggestedPrice
            if (price === null) {
                throw new ServiceError('BAD PARAMETERS', 'Produktet har ingen foreslått pris, så prisen må oppgis.')
            }

            return prisma.shopProduct.create({
                data: {
                    shopId: params.shopId,
                    productId: data.productId,
                    price,
                },
            })
        },
    }),

    /** Changes the price of a product in the shop, and whether it is on sale there. */
    updateProduct: defineOperation({
        authorizer: async ({ params, prisma }) => shopAuth.updateProduct.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({
                params: { shopId: params.shopId },
                prisma,
            }),
        }),
        paramsSchema: shopSchemas.params.updateProduct,
        dataSchema: shopSchemas.data.updateProduct,
        operation: async ({ prisma, params, data }) => prisma.shopProduct.update({
            where: {
                shopId_productId: {
                    shopId: params.shopId,
                    productId: params.productId,
                },
            },
            data,
        }),
    }),

    /** The products of the catalogue the shop does not sell yet, for its administrators to pick from. */
    readProductsToConnect: defineOperation({
        authorizer: async ({ params, prisma }) => shopAuth.readProductsToConnect.data({
            visibility: await visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: shopSchemas.params.readProductsToConnect,
        operation: async ({ prisma, params }) => prisma.product.findMany({
            where: { ShopProduct: { none: { shopId: params.shopId } } },
            orderBy: { name: 'asc' },
        }),
    }),
} as const
