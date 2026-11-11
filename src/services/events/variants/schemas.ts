import { eventQuotaSchemas } from '@/services/events/quotas/schemas'
import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Varianten må ha et navn').max(50, 'Navnet kan ha maks 50 tegn'),
    registrationStart: Zpn.date({ label: 'Påmeldingsstart' }),
    registrationEnd: Zpn.date({ label: 'Påmeldingsslutt' }),
    takesPayment: Zpn.checkboxOrBoolean({ label: 'Tar betaling' }).default(false),
    price: z.coerce.number().min(0).transform(val => convertAmount(val)).optional(),
    paymentStart: Zpn.date({ label: 'Betalingsstart' }).optional(),
    paymentEnd: Zpn.date({ label: 'Betalingsslutt' }).optional(),
    requeueUnpaidRegistrations: Zpn.checkboxOrBoolean({ label: 'Flytt ubetalte bakerst på ventelisten' }).default(false),
})

/**
 * The fields as an authorized operation has parsed them. The sub-operations parse what they are
 * given once more, so they take these: parsing them again changes nothing. The price is in øre,
 * as it is stored, and must not be converted from kroner twice.
 */
const parsedFieldSchemas = dataFieldSchemas.extend({
    price: z.number().int().min(0).optional(),
    variantIds: z.array(z.number().int()),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number(),
})

const variantFields = {
    name: true,
    registrationStart: true,
    registrationEnd: true,
    takesPayment: true,
    price: true,
    paymentStart: true,
    paymentEnd: true,
    requeueUnpaidRegistrations: true,
} as const

// A variant with its quotas as a save of the whole event gives it. One without an id is new.
const variantSetup = {
    id: z.number().int().optional(),
    quotas: eventQuotaSchemas.data.saveSetup.shape.quotas,
}

const variantId = paramsFieldSchemas.pick({
    id: true,
})

const eventId = paramsFieldSchemas.pick({
    eventId: true,
})

/** The variants of an event with their quotas as its form posts them, the price in kroner. */
export const eventVariantSetupFormSchema = z.array(dataFieldSchemas.pick(variantFields).extend(variantSetup))

export const eventVariantSchemas = {
    data: {
        create: parsedFieldSchemas.pick(variantFields),
        update: parsedFieldSchemas.pick(variantFields).partial(),
        reorder: parsedFieldSchemas.pick({
            variantIds: true,
        }),
        saveSetup: z.object({
            variants: z.array(parsedFieldSchemas.pick(variantFields).extend(variantSetup)),
        }),
    },
    params: {
        readMany: eventId,
        create: eventId,
        update: variantId,
        destroy: variantId,
        reorder: eventId,
        saveSetup: eventId,
    },
}
