import '@pn-server-only'
import { ServiceError } from '@/services/error'
import type { Prisma } from '@/prisma-generated-pn-types'

export type VariantFields = {
    name: string,
    registrationStart: Date,
    registrationEnd: Date,
    takesPayment: boolean,
    price?: number | null,
    paymentStart?: Date | null,
    paymentEnd?: Date | null,
}

/** Passes the values the variant will have, so a partial update is judged whole. */
export function assertValidVariant(variant: Omit<VariantFields, 'name'>) {
    if (variant.registrationStart > variant.registrationEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Påmeldingen må jo starte før den slutter')
    }
    if (!variant.takesPayment) return
    if (!variant.price) {
        throw new ServiceError('BAD PARAMETERS', 'En variant som tar betaling må ha en pris')
    }
    if (!variant.paymentStart || !variant.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingsdatoer må settes når varianten tar betaling')
    }
    if (variant.paymentStart > variant.paymentEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Betalingen må jo starte før den slutter')
    }
}

/** What a variant that does not take payment holds in the payment fields. */
export const unpaidVariant = { price: null, paymentStart: null, paymentEnd: null }

/** Creates a variant last in the order of its event. Run it inside the caller's transaction. */
export async function createVariant(tx: Prisma.TransactionClient, eventId: number, data: VariantFields) {
    assertValidVariant(data)
    const last = await tx.eventVariant.findFirst({
        where: { eventId },
        orderBy: { order: 'desc' },
        select: { order: true },
    })
    return await tx.eventVariant.create({
        data: {
            eventId,
            order: (last?.order ?? -1) + 1,
            name: data.name,
            registrationStart: data.registrationStart,
            registrationEnd: data.registrationEnd,
            takesPayment: data.takesPayment,
            ...(data.takesPayment
                ? { price: data.price, paymentStart: data.paymentStart, paymentEnd: data.paymentEnd }
                : unpaidVariant),
        },
    })
}
