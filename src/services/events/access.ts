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
            quotas: { select: { visibility: { include: visibilityIncluder } } },
        },
    })
    return {
        published: event.published,
        canBeViewedBy: event.canBeViewedBy,
        adminVisibility: toMatrix(event.visibilityAdmin),
        quotaVisibilities: event.quotas.map(quota => toMatrix(quota.visibility)),
    }
}

/** The event a quota belongs to. */
export async function readEventIdOfQuota(prisma: PrismaPossibleTransaction<false>, quotaId: number): Promise<number> {
    const quota = await prisma.eventRegistrationQuota.findUniqueOrThrow({
        where: { id: quotaId },
        select: { eventId: true },
    })
    return quota.eventId
}
