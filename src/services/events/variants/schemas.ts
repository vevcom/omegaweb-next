import { Zpn } from '@/lib/fields/zpn'
import { convertAmount } from '@/lib/currency/convert'
import { z } from 'zod'

const dataFieldSchemas = z.object({
    name: z.string().trim().min(1, 'Varianten må ha et navn').max(50, 'Navnet kan ha maks 50 tegn'),
    registrationStart: Zpn.date({ label: 'Påmeldingsstart' }),
    description: z.string().trim().max(120, 'Maks 120 tegn').nullish()
        .transform(value => value || null),
    registrationEnd: Zpn.date({ label: 'Påmeldingsslutt' }),
    takesPayment: Zpn.checkboxOrBoolean({ label: 'Tar betaling' }).default(false),
    price: z.coerce.number().min(0).transform(val => convertAmount(val)).optional(),
    paymentStart: Zpn.date({ label: 'Betalingsstart' }).optional(),
    paymentEnd: Zpn.date({ label: 'Betalingsslutt' }).optional(),
    requeueUnpaidRegistrations: Zpn.checkboxOrBoolean({ label: 'Flytt ubetalte bakerst på ventelisten' }).default(false),
})

const paramsFieldSchemas = z.object({
    id: z.number(),
    eventId: z.number(),
})

const variantFields = {
    name: true,
    description: true,
    registrationStart: true,
    registrationEnd: true,
    takesPayment: true,
    price: true,
    paymentStart: true,
    paymentEnd: true,
    requeueUnpaidRegistrations: true,
} as const

const variantId = paramsFieldSchemas.pick({
    id: true,
})

const eventId = paramsFieldSchemas.pick({
    eventId: true,
})

export const eventVariantSchemas = {
    data: {
        create: dataFieldSchemas.pick(variantFields),
        update: dataFieldSchemas.pick(variantFields).partial(),
    },
    params: {
        readMany: eventId,
        create: eventId,
        update: variantId,
        destroy: variantId,
    },
}
