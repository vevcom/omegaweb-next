import { Zpn } from '@/lib/fields/zpn'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const fieldSchemas = z.object({
    name: z.string().min(3),
    description: z.string(),
    shopId: z.coerce.number().int(),
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

export const shopSchemas = {
    create: fieldSchemas.pick({
        name: true,
        description: true,
        visibilityAdminRequirements: true,
        visibilityRegularRequirements: true,
    }),
    connectToLedger: fieldSchemas.pick({
        ledgerAccountId: true,
    }),
}

const shopId = fieldSchemas.pick({
    shopId: true,
})

export const shopParamsSchemas = {
    visibility: shopId,
    read: shopId,
    connectToLedger: shopId,
}
