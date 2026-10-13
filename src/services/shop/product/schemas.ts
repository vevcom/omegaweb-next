import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    shopId: z.coerce.number().int(),
    name: z.string().min(3),
    description: z.string(),
    price: z.coerce.number().int().min(1).transform((val) => convertAmount(val)),
    barcode: z.string().or(z.number()).optional(),
    active: Zpn.checkboxOrBoolean({ label: 'Active' }),
    productId: z.coerce.number().int(),
})

const paramsFieldSchemas = z.object({
    shopId: z.coerce.number(),
    productId: z.number(),
    barcode: z.string().or(z.number()).optional(),
})

export const productSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            barcode: true,
        }),
        update: dataFieldSchemas.pick({
            productId: true,
            name: true,
            description: true,
            barcode: true,
        }),
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
            shopId: true,
            productId: true,
            price: true,
        }),
    },
    params: {
        createForShop: paramsFieldSchemas.pick({
            shopId: true,
        }),
        read: paramsFieldSchemas.pick({
            productId: true,
        }),
        readByBarCode: paramsFieldSchemas.pick({
            barcode: true,
            shopId: true,
        }),
        updateForShop: paramsFieldSchemas.pick({
            shopId: true,
            productId: true,
        }),
    },
}
