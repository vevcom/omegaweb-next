import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Kvoten må ha et navn').max(50, 'Navnet kan ha maks 50 tegn'),
    places: z.coerce.number().int().min(0, 'Antall plasser kan ikke være negativt'),
    // In øre. Set exactly when the event takes payment.
    price: z.coerce.number().min(0).transform(val => convertAmount(val)).optional(),
    registrationStart: Zpn.date({ label: 'Påmeldingsstart' }),
    registrationEnd: Zpn.date({ label: 'Påmeldingsslutt' }),
    // No requirements means everyone may register through the quota.
    visibilityRequirements: Zpn.json({
        label: 'Hvem kan melde seg på',
        schema: visibilityRequirementsSchema,
    }).default([]),
    // Every quota of the event, in the order they are to fill.
    quotaIds: Zpn.json({
        label: 'Rekkefølge',
        schema: z.array(z.number().int()),
    }),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number(),
})

const quotaFields = {
    name: true,
    places: true,
    price: true,
    registrationStart: true,
    registrationEnd: true,
} as const

const quotaId = paramsFieldSchemas.pick({
    id: true,
})

const eventId = paramsFieldSchemas.pick({
    eventId: true,
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
        readMany: eventId,
        create: eventId,
        update: quotaId,
        destroy: quotaId,
        reorder: eventId,
        visibility: quotaId,
    },
}
