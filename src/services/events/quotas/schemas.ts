import { Zpn } from '@/lib/fields/zpn'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Kvoten må ha et navn').max(50, 'Navnet kan ha maks 50 tegn'),
    places: z.coerce.number().int().min(0, 'Antall plasser kan ikke være negativt'),
    // No requirements means everyone may register through the quota.
    visibilityRequirements: Zpn.json({
        label: 'Hvem kan melde seg på',
        schema: visibilityRequirementsSchema,
    }).default([]),
    quotaIds: Zpn.json({
        label: 'Rekkefølge',
        schema: z.array(z.number().int()),
    }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    variantId: z.number(),
})

const quotaFields = {
    name: true,
    places: true,
} as const

const quotaId = paramsFieldSchemas.pick({
    id: true,
})

const variantId = paramsFieldSchemas.pick({
    variantId: true,
})

export const eventQuotaSchemas = {
    data: {
        create: dataFieldSchemas.pick({
            ...quotaFields,
            visibilityRequirements: true,
        }),
        update: dataFieldSchemas.pick(quotaFields).partial(),
        reorder: dataFieldSchemas.pick({
            quotaIds: true,
        }),
    },
    params: {
        readMany: variantId,
        create: variantId,
        update: quotaId,
        destroy: quotaId,
        reorder: variantId,
        visibility: quotaId,
    },
}
