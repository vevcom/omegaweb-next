import '@pn-server-only'
import { productAuth } from './auth'
import { productSchemas } from './schemas'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { shopOperations } from '@/services/shop/shop/operations'
import type { ExtendedProduct } from './types'

export const productOperations = {
    create: defineOperation({
        authorizer: () => productAuth.create,
        dataSchema: productSchemas.data.create,
        operation: async ({ prisma, data }) => prisma.product.create({
            data: {
                name: data.name.toUpperCase(),
                description: data.description,
                barcode: convertBarcode(data.barcode),
            },
        }),
    }),

    /** Creates a product and puts it on sale in one shop in the same write. */
    createForShop: defineOperation({
        authorizer: async ({ params, prisma }) => productAuth.createForShop.data({
            visibility: await shopOperations.visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: productSchemas.params.createForShop,
        dataSchema: productSchemas.data.createForShop,
        operation: async ({ prisma, params, data }) => prisma.product.create({
            data: {
                name: data.name.toUpperCase(),
                description: data.description,
                barcode: convertBarcode(data.barcode),
                ShopProduct: {
                    create: {
                        price: data.price,
                        shop: {
                            connect: {
                                id: params.shopId,
                            },
                        },
                    },
                },
            },
        }),
    }),

    /** Puts a product that already exists on sale in a shop. */
    createShopConnection: defineOperation({
        authorizer: async ({ params, prisma }) => productAuth.createShopConnection.data({
            visibility: await shopOperations.visibility.readDoubleLevelMatrixInternal({ params, prisma }),
        }),
        paramsSchema: productSchemas.params.createShopConnection,
        dataSchema: productSchemas.data.createShopConnection,
        operation: async ({ prisma, params, data }) => prisma.shopProduct.create({
            data: {
                shop: {
                    connect: {
                        id: params.shopId,
                    },
                },
                product: {
                    connect: {
                        id: data.productId,
                    },
                },
                price: data.price,
            },
        }),
    }),

    readMany: defineOperation({
        authorizer: () => productAuth.readMany,
        operation: async ({ prisma }) => prisma.product.findMany(),
    }),

    read: defineOperation({
        authorizer: () => productAuth.read,
        paramsSchema: productSchemas.params.read,
        operation: async ({ prisma, params }) => prisma.product.findUniqueOrThrow({
            where: {
                id: params.productId,
            },
            include: {
                ShopProduct: {
                    include: {
                        shop: true,
                    },
                },
            },
        }),
    }),

    /**
     * The product behind a barcode as one shop sells it, for the kiosk. A product the shop does
     * not sell, or has taken off sale, is NOT FOUND there even though it exists.
     */
    readByBarCode: defineOperation({
        authorizer: () => productAuth.readByBarCode,
        paramsSchema: productSchemas.params.readByBarCode,
        operation: async ({ prisma, params }): Promise<ExtendedProduct> => {
            const product = await prisma.product.findUnique({
                where: {
                    barcode: params.barcode,
                },
                include: {
                    ShopProduct: {
                        where: {
                            shopId: params.shopId,
                            active: true,
                        },
                    },
                },
            })
            const notFound = () => new ServiceError(
                'NOT FOUND',
                `Fant ingen vare med strekkode ${params.barcode} i butikk ${params.shopId}.`
            )
            if (!product) throw notFound()

            const { ShopProduct: shopProducts, ...productFields } = product
            const [shopProduct] = shopProducts
            if (!shopProduct) throw notFound()

            return {
                ...productFields,
                price: shopProduct.price,
                active: shopProduct.active,
            }
        },
    }),

    update: defineOperation({
        authorizer: () => productAuth.update,
        paramsSchema: productSchemas.params.update,
        dataSchema: productSchemas.data.update,
        operation: async ({ prisma, params, data }) => prisma.product.update({
            where: {
                id: params.productId,
            },
            data: {
                name: data.name.toUpperCase(),
                description: data.description,
                barcode: convertBarcode(data.barcode),
            },
        }),
    }),

    /** Updates a product together with its price and whether it is on sale in one shop. */
    updateForShop: defineOperation({
        authorizer: async ({ params, prisma }) => productAuth.updateForShop.data({
            visibility: await shopOperations.visibility.readDoubleLevelMatrixInternal({
                params: { shopId: params.shopId },
                prisma,
            }),
        }),
        paramsSchema: productSchemas.params.updateForShop,
        dataSchema: productSchemas.data.updateForShop,
        operation: async ({ prisma, params, data }) => prisma.product.update({
            where: {
                id: params.productId,
            },
            data: {
                name: data.name.toUpperCase(),
                description: data.description,
                barcode: convertBarcode(data.barcode),
                ShopProduct: {
                    update: {
                        where: {
                            shopId_productId: {
                                shopId: params.shopId,
                                productId: params.productId,
                            },
                        },
                        data: {
                            price: data.price,
                            active: data.active,
                        },
                    },
                },
            },
        }),
    }),
} as const

/** The barcode as stored: trimmed, and null when the form left it empty. */
function convertBarcode(barcode?: string | number) {
    if (typeof barcode === 'string' || typeof barcode === 'number') {
        const stringBarcode = String(barcode).trim()
        if (stringBarcode.length > 0) {
            return stringBarcode
        }
    }
    return null
}
