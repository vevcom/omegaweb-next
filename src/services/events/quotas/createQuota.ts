import '@pn-server-only'
import { visibilityOperations } from '@/services/visibility/operations'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { visibilityRequirementsSchema } from '@/services/visibility/schemas'
import type { z } from 'zod'

/** Creates a quota with its visibility, last in the fill order of its variant. Run it inside the caller's transaction. */
export async function createQuota(
    tx: Prisma.TransactionClient,
    variantId: number,
    data: {
        name: string,
        places: number,
        visibilityRequirements: z.infer<typeof visibilityRequirementsSchema>,
    },
) {
    const last = await tx.eventQuota.findFirst({
        where: { variantId },
        orderBy: { order: 'desc' },
        select: { order: true },
    })
    const visibility = await visibilityOperations.createWithRequirements.internalCall({
        prisma: tx,
        data: { requirements: data.visibilityRequirements },
    })

    return await tx.eventQuota.create({
        data: {
            variantId,
            order: (last?.order ?? -1) + 1,
            name: data.name,
            places: data.places,
            visibilityId: visibility.id,
        },
    })
}
