import '@pn-server-only'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { EventAccess } from './types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

/** Reads what the rules of eventAuth need to know about an event, for `.data()`. */
export async function readEventAccess(prisma: PrismaPossibleTransaction<false>, eventId: number): Promise<EventAccess> {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: {
            published: true,
            canBeViewedBy: true,
            visibilityAdmin: { include: visibilityIncluder },
            variants: { select: { quotas: { select: { visibility: { include: visibilityIncluder } } } } },
        },
    })
    return {
        published: event.published,
        canBeViewedBy: event.canBeViewedBy,
        adminVisibility: toMatrix(event.visibilityAdmin),
        quotaVisibilities: event.variants.flatMap(variant => variant.quotas.map(quota => toMatrix(quota.visibility))),
    }
}

/** The event a variant belongs to. */
export async function readEventIdOfVariant(prisma: PrismaPossibleTransaction<false>, variantId: number): Promise<number> {
    const variant = await prisma.eventVariant.findUniqueOrThrow({
        where: { id: variantId },
        select: { eventId: true },
    })
    return variant.eventId
}

/** The event a quota belongs to, through its variant. */
export async function readEventIdOfQuota(prisma: PrismaPossibleTransaction<false>, quotaId: number): Promise<number> {
    const quota = await prisma.eventQuota.findUniqueOrThrow({
        where: { id: quotaId },
        select: { variant: { select: { eventId: true } } },
    })
    return quota.variant.eventId
}
