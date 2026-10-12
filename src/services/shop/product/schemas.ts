import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { z } from 'zod'

const fieldSchemas = z.object({
    shopId: z.coerce.number().int(),
    name: z.string().min(3),
    description: z.string(),
    price: z.coerce.number().int().min(1).transform((val) => convertAmount(val)),
    barcode: z.string().or(z.number()).optional(),
    active: Zpn.checkboxOrBoolean({ label: 'Active' }),
    productId: z.coerce.number().int(),
})

export const productSchemas = {
    create: fieldSchemas.pick({
        name: true,
        description: true,
        barcode: true,
    }),

    update: fieldSchemas.pick({
        productId: true,
        name: true,
        description: true,
        barcode: true,
    }),

    readByBarCode: fieldSchemas.pick({
        barcode: true,
        shopId: true,
    }),

    createForShop: fieldSchemas.pick({
        name: true,
        description: true,
        price: true,
        barcode: true,
    }),

    updateForShop: fieldSchemas.pick({
        name: true,
        description: true,
        price: true,
        barcode: true,
        active: true,
    }),

    createShopConnection: fieldSchemas.pick({
        shopId: true,
        productId: true,
        price: true,
    }),
}
