import { Zpn } from '@/lib/fields/zpn'
import { productDataFieldSchemas } from '@/services/shop/product/schemas'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().min(3),
    description: z.string(),
    ledgerAccountId: z.coerce.number().int(),
    // Both levels are set as the shop is created: created with an empty admin level it would be
    // administrable by anyone until someone narrowed it. The regular level may stay empty, which
    // means everyone - whereas a requirement with no conditions can never be satisfied, and so
    // means no one but those bypassing with SHOP_ADMIN.
    visibilityAdminRequirements: Zpn.json({
        label: 'Hvem kan administrere',
        schema: visibilityRequirementsSchema.min(1, 'Du må velge hvem som kan administrere butikken'),
    }),
    visibilityRegularRequirements: Zpn.json({
        label: 'Hvem kan handle',
        schema: visibilityRequirementsSchema,
    }).default([]),
})

const paramsFieldSchemas = z.object({
    shopId: z.number(),
    productId: z.number(),
})

/** What a shop is called and how it is described. */
const shopDetails = dataFieldSchemas.pick({
    name: true,
    description: true,
})

const shopId = paramsFieldSchemas.pick({
    shopId: true,
})

export const shopSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            name: true,
            description: true,
            visibilityAdminRequirements: true,
            visibilityRegularRequirements: true,
        }),
        update: shopDetails,
        connectToLedgerAccount: dataFieldSchemas.pick({
            ledgerAccountId: true,
        }),
        // A product created from a shop is what the product service stores, at a price the shop
        // sells it for, which also becomes its suggested price.
        createProduct: productDataFieldSchemas.pick({
            name: true,
            description: true,
            barcode: true,
            price: true,
        }),
        connectProduct: productDataFieldSchemas.pick({
            productId: true,
            optionalPrice: true,
        }),
        updateProduct: productDataFieldSchemas.pick({
            price: true,
            active: true,
        }),
    },
    params: {
        visibility: shopId,
        read: shopId,
        update: shopId,
        connectToLedgerAccount: shopId,
        createProduct: shopId,
        connectProduct: shopId,
        updateProduct: paramsFieldSchemas.pick({
            shopId: true,
            productId: true,
        }),
        readProductsToConnect: shopId,
    },
}
