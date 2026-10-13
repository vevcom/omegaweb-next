import { defineOperation } from '@/services/serviceOperation'
import '@pn-server-only'
import { ServiceError } from '@/services/error'
import type { ExtendedProduct } from './types'
import { productAuth } from './auth'
import { productSchemas } from './schemas'

export const productOperations = {
    create: defineOperation({
        authorizer: () => productAuth.create,
        dataSchema: productSchemas.data.create,
        operation: async ({ prisma, data }) => prisma.product.create({
            data: {
                ...data,
                barcode: convertBarcode(data.barcode),
                name: data.name.toUpperCase()
            }
        })
    }),

    createForShop: defineOperation({
        authorizer: () => productAuth.create,
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
        })
    }),

    createShopConnection: defineOperation({
        authorizer: () => productAuth.createShopConnection,
        dataSchema: productSchemas.data.createShopConnection,
        operation: async ({ prisma, data }) => prisma.shopProduct.create({
            data: {
                shop: {
                    connect: {
                        id: data.shopId,
                    }
                },
                product: {
                    connect: {
                        id: data.productId,
                    },
                },
                price: data.price,
            }
        })
    }),

    readMany: defineOperation({
        authorizer: () => productAuth.read,
        operation: async ({ prisma }) => await prisma.product.findMany()
    }),

    read: defineOperation({
        authorizer: () => productAuth.read,
        paramsSchema: productSchemas.params.read,
        operation: async ({ prisma, params }) => await prisma.product.findUniqueOrThrow({
            where: {
                id: params.productId
            },
            include: {
                ShopProduct: {
                    include: {
                        shop: true
                    }
                }
            }
        })
    }),

    readByBarCode: defineOperation({
        authorizer: () => productAuth.read,
        paramsSchema: productSchemas.params.readByBarCode,
        operation: async ({ prisma, params }): Promise<ExtendedProduct | null> => {
            if (!params.barcode) {
                throw new ServiceError('BAD PARAMETERS', 'Barcode is required.')
            }

            const results = await prisma.product.findUnique({
                where: {
                    barcode: params.barcode.toString()
                },
                include: {
                    ShopProduct: {
                        where: {
                            shopId: params.shopId,
                            active: true,
                        }
                    }
                }
            })

            if (!results || results.ShopProduct.length === 0) {
                throw new ServiceError(
                    'NOT FOUND',
                    `Could not find any prduct with barcode ${params.barcode} in shop ${params.shopId}.`
                )
            }

            const ret = {
                ...results,
                price: 0,
                active: true,
            }
            Reflect.deleteProperty(ret, 'ShopProduct')
            ret.price = results.ShopProduct[0].price
            ret.active = results.ShopProduct[0].active

            return ret
        }
    }),

    update: defineOperation({
        authorizer: () => productAuth.update,
        dataSchema: productSchemas.data.update,
        operation: async ({ prisma, data }) => prisma.product.update({
            where: {
                id: data.productId,
            },
            data: {
                name: data.name.toUpperCase(),
                description: data.description,
                barcode: convertBarcode(data.barcode),
            },
        })
    }),

    updateForShop: defineOperation({
        authorizer: () => productAuth.update,
        dataSchema: productSchemas.data.updateForShop,
        paramsSchema: productSchemas.params.updateForShop,
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
        })
    }),
} as const

export function convertBarcode(barcode?: string | number) {
    if (typeof barcode === 'string' || typeof barcode === 'number') {
        const stringBarcode = String(barcode).trim()
        if (stringBarcode.length > 0) {
            return stringBarcode
        }
    }
    return null
}

