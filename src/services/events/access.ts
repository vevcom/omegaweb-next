import '@pn-server-only'
import { ServiceError } from '@/services/error'
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

/**
 * An event seen only by those who can register is seen through its quotas, so without any it is
 * seen by nobody but its administrators. A quota without places will do, which is how an event
 * for members only, without registration, is kept visible. Refused once the event is published,
 * or is about to be; a draft is still being set up.
 */
export async function assertSeenThroughQuotas(
    prisma: PrismaPossibleTransaction<false>,
    eventId: number,
    state?: { published: boolean },
) {
    const event = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { published: true, canBeViewedBy: true },
    })
    if (!(state?.published ?? event.published) || event.canBeViewedBy !== 'CAN_REGISTER') return
    if (await prisma.eventQuota.count({ where: { variant: { eventId } } }) === 0) {
        throw new ServiceError(
            'BAD PARAMETERS',
            'Arrangementet er bare synlig for dem som kan melde seg på, så det må ha minst én kvote. '
            + 'En kvote uten plasser holder.'
        )
    }
}
