import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    productId: z.coerce.number().int(),
    name: z.string().min(3),
    description: z.string(),
    price: z.coerce.number().int().min(1).transform(amount => convertAmount(amount)),
    barcode: z.string().or(z.number()).optional(),
    active: Zpn.checkboxOrBoolean({ label: 'Active' }),
})

const paramsFieldSchemas = z.object({
    shopId: z.coerce.number(),
    productId: z.number(),
    barcode: z.string().min(1),
})

/** What a product is, apart from where and at what price it is sold. */
const productFields = dataFieldSchemas.pick({
    name: true,
    description: true,
    barcode: true,
})

const product = paramsFieldSchemas.pick({
    productId: true,
})

const shop = paramsFieldSchemas.pick({
    shopId: true,
})

export const productSchemas = {
    data: {
        create: productFields,
        update: productFields,
        createForShop: dataFieldSchemas.pick({
            name: true,
            description: true,
            price: true,
            barcode: true,
        }),
        updateForShop: dataFieldSchemas.pick({
            name: true,
            description: true,
            price: true,
            barcode: true,
            active: true,
        }),
        createShopConnection: dataFieldSchemas.pick({
            productId: true,
            price: true,
        }),
    },
    params: {
        read: product,
        readByBarCode: paramsFieldSchemas.pick({
            barcode: true,
            shopId: true,
        }),
        update: product,
        createForShop: shop,
        updateForShop: paramsFieldSchemas.pick({
            shopId: true,
            productId: true,
        }),
        createShopConnection: shop,
    },
}
