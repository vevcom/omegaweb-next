import '@pn-server-only'
import { ServiceError } from '@/services/error'
import { visibilityOperations } from '@/services/visibility/operations'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import type { z } from 'zod'

type QuotaFields = {
    name: string,
    places: number,
    price?: number | null,
    registrationStart: Date,
    registrationEnd: Date,
}

/**
 * A quota's registration period ends after it starts, and it has a price exactly when its event
 * takes payment. Callers pass the values the quota will have, so a partial update is judged whole.
 */
export function assertValidQuota(
    quota: Pick<QuotaFields, 'registrationStart' | 'registrationEnd' | 'price'>,
    event: { takesPayment: boolean },
) {
    if (quota.registrationStart > quota.registrationEnd) {
        throw new ServiceError('BAD PARAMETERS', 'Påmeldingen må jo starte før den slutter')
    }
    if (event.takesPayment && (quota.price === null || quota.price === undefined)) {
        throw new ServiceError('BAD PARAMETERS', 'Kvoten må ha en pris når arrangementet tar betaling')
    }
}

/**
 * Creates a quota with its visibility, last in the fill order of its event. Run it inside the
 * caller's transaction, so the visibility is never left without its quota.
 */
export async function createQuota(
    tx: Prisma.TransactionClient,
    event: { id: number, takesPayment: boolean },
    data: QuotaFields & { visibilityRequirements: z.infer<typeof visibilityRequirementsSchema> },
) {
    assertValidQuota(data, event)

    const last = await tx.eventRegistrationQuota.findFirst({
        where: { eventId: event.id },
        orderBy: { order: 'desc' },
        select: { order: true },
    })
    const visibility = await visibilityOperations.createWithRequirements.internalCall({
        prisma: tx,
        data: { requirements: data.visibilityRequirements },
    })

    return await tx.eventRegistrationQuota.create({
        data: {
            event: { connect: { id: event.id } },
            order: (last?.order ?? -1) + 1,
            name: data.name,
            places: data.places,
            price: event.takesPayment ? data.price : null,
            registrationStart: data.registrationStart,
            registrationEnd: data.registrationEnd,
            visibility: { connect: { id: visibility.id } },
        },
    })
}
