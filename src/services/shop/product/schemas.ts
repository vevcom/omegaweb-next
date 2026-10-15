import { convertAmount } from '@/lib/currency/convert'
import { Zpn } from '@/lib/fields/zpn'
import { z } from 'zod'

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

/** Written in kroner, possibly with øre, and stored in øre. */
const price = z.coerce.number().finite().min(1, 'Prisen må være minst 1 kr').transform(amount => convertAmount(amount))

/**
 * The fields of a product, normalized as they are stored. Exported for the shop service, whose
 * operations create products and connect them to a shop, so both write the same product.
 */
export const productDataFieldSchemas = z.object({
    productId: z.coerce.number().int(),
    name: z.string().trim().min(3, 'Navnet må være minst 3 tegn').transform(name => name.toUpperCase()),
    description: z.string().trim(),
    barcode: z.string().or(z.number()).optional().transform(convertBarcode),
    // What a shop sells the product for when it is connected without a price of its own.
    suggestedPrice: z.union([z.literal('').transform(() => null), price]).nullable().default(null),
    price,
    // A form leaves the price empty to take the suggested one.
    optionalPrice: z.union([z.literal('').transform(() => undefined), price]).optional(),
    active: Zpn.checkboxOrBoolean({ label: 'Aktiv' }),
})

const paramsFieldSchemas = z.object({
    shopId: z.coerce.number(),
    productId: z.number(),
    barcode: z.string().min(1),
})

/** What a product is, apart from where and at what price it is sold. */
const productFields = productDataFieldSchemas.pick({
    name: true,
    description: true,
    barcode: true,
    suggestedPrice: true,
})

const product = paramsFieldSchemas.pick({
    productId: true,
})

export const productSchemas = {
    data: {
        create: productFields,
        // A suggested price left out stays as it is; one emptied is cleared.
        update: productFields.extend({
            suggestedPrice: productDataFieldSchemas.shape.suggestedPrice.optional(),
        }),
    },
    params: {
        read: product,
        readByBarCode: paramsFieldSchemas.pick({
            barcode: true,
            shopId: true,
        }),
        update: product,
    },
}
