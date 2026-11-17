import { Zpn } from '@/lib/fields/zpn'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Kvoten må ha et navn').max(50, 'Navnet kan ha maks 50 tegn'),
    places: z.coerce.number({ invalid_type_error: 'Antall plasser må være et tall' })
        .int('Antall plasser må være et helt tall')
        .min(0, 'Antall plasser kan ikke være negativt'),
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

const quotaFieldsWithVisibility = {
    ...quotaFields,
    visibilityRequirements: true,
} as const

// A quota as a save of the whole variant gives it. One without an id is new.
const quotaSetup = dataFieldSchemas.pick(quotaFieldsWithVisibility).extend({
    id: z.number().int().optional(),
})

const quotaId = paramsFieldSchemas.pick({
    id: true,
})

const variantId = paramsFieldSchemas.pick({
    variantId: true,
})

export const eventQuotaSchemas = {
    data: {
        create: dataFieldSchemas.pick(quotaFieldsWithVisibility),
        update: dataFieldSchemas.pick(quotaFieldsWithVisibility).partial(),
        reorder: dataFieldSchemas.pick({
            quotaIds: true,
        }),
        saveSetup: z.object({
            quotas: z.array(quotaSetup),
        }),
    },
    params: {
        readMany: variantId,
        create: variantId,
        update: quotaId,
        destroy: quotaId,
        reorder: variantId,
        saveSetup: variantId,
        visibility: quotaId,
    },
}
