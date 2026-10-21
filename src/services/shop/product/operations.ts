import '@pn-server-only'
import { productAuth } from './auth'
import { productSchemas } from './schemas'
import { productImageIncluder } from './constants'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { shopOperations } from '@/services/shop/shop/operations'
import { cmsImageOperations } from '@/cms/images/operations'
import { EMPTY_VISIBILITY } from '@/auth/visibility/emptyVisibility'
import type { ExtendedProduct } from './types'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { DoubleLevelVisibilityMatrix } from '@/services/visibility/types'

export const productOperations = {
    /** Creates a product in the catalogue. A shop creates products on sale through its own operation. */
    create: defineOperation({
        authorizer: () => productAuth.create,
        dataSchema: productSchemas.data.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => prisma.$transaction(async tx => {
            const image = await cmsImageOperations.create.internalCall({
                data: {},
                prisma: tx,
                operationImplementationFields: { special: null },
            })
            return tx.product.create({
                data: {
                    ...data,
                    image: { connect: { id: image.id } },
                },
            })
        }),
    }),

    readMany: defineOperation({
        authorizer: () => productAuth.readMany,
        operation: async ({ prisma }) => prisma.product.findMany({
            orderBy: { name: 'asc' },
            include: productImageIncluder,
        }),
    }),

    read: defineOperation({
        authorizer: () => productAuth.read,
        paramsSchema: productSchemas.params.read,
        operation: async ({ prisma, params }) => prisma.product.findUniqueOrThrow({
            where: {
                id: params.productId,
            },
            include: {
                ...productImageIncluder,
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

    /** Changes what a product is. Its price and whether it is on sale are changed from each shop. */
    update: defineOperation({
        authorizer: async ({ params, prisma }) => productAuth.update.data({
            visibility: await soleShopVisibility(prisma, params.productId),
        }),
        paramsSchema: productSchemas.params.update,
        dataSchema: productSchemas.data.update,
        operation: async ({ prisma, params, data }) => prisma.product.update({
            where: {
                id: params.productId,
            },
            data,
        }),
    }),

    /** Changes the product's photo, for those who may change the product. */
    updateCmsImage: cmsImageOperations.update.implement({
        implementationParamsSchema: productSchemas.params.updateCmsImage,
        authorizer: async ({ implementationParams, prisma }) => productAuth.updateCmsImage.data({
            visibility: await soleShopVisibility(prisma, implementationParams.productId),
        }),
        ownershipCheck: async ({ implementationParams, params, prisma }) =>
            (await prisma.product.findUniqueOrThrow({
                where: { id: implementationParams.productId },
                select: { imageId: true },
            })).imageId === params.cmsImageId,
    }),
} as const

/**
 * The admin level of the one shop selling the product, for the update rule. A product sold in
 * none or in several shops gives a level no one passes, leaving it to SHOP_ADMIN.
 */
async function soleShopVisibility(
    prisma: Prisma.TransactionClient,
    productId: number,
): Promise<DoubleLevelVisibilityMatrix> {
    const sellers = await prisma.shopProduct.findMany({
        where: { productId },
        select: { shopId: true },
        take: 2,
    })
    if (sellers.length !== 1) return EMPTY_VISIBILITY

    return shopOperations.visibility.readDoubleLevelMatrixInternal({
        params: { shopId: sellers[0].shopId },
        prisma,
    })
}
