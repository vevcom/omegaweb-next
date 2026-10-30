import '@pn-server-only'
import { eventRegistrationQueueOrder } from './constants'
import { waitingInEvent } from './queue'
import { checkVisibility } from '@/auth/visibility/checkVisibility'
import { membershipFilterSelection } from '@/services/groups/constants'
import { toMatrix, visibilityIncluder } from '@/services/visibility/implement'
import type { Prisma } from '@/prisma-generated-pn-types'

export type PromotedRegistration = {
    id: number,
    userId: number | null,
    contact: { email: string | null } | null,
}

/**
 * Fills the free places of a quota from the waiting list of its event: the first waiting, in queue
 * order, whose memberships pass the quota's visibility, until the quota is full or no one left
 * passes. A guest has no memberships, so passes only a quota open to everyone. Run it under
 * `lockEvent`, after the change that freed the places, and tell the promoted once it is saved.
 */
export async function promoteToQuota(tx: Prisma.TransactionClient, quotaId: number): Promise<PromotedRegistration[]> {
    const quota = await tx.eventRegistrationQuota.findUniqueOrThrow({
        where: { id: quotaId },
        select: {
            eventId: true,
            places: true,
            visibility: { include: visibilityIncluder },
            _count: { select: { registrations: true } },
        },
    })
    const free = quota.places - quota._count.registrations
    if (free <= 0) return []

    const waiting = await tx.eventRegistration.findMany({
        where: waitingInEvent(quota.eventId),
        orderBy: eventRegistrationQueueOrder,
        select: {
            id: true,
            userId: true,
            contact: { select: { email: true } },
            user: { select: { memberships: { select: membershipFilterSelection } } },
        },
    })
    const visibility = toMatrix(quota.visibility)
    const promoted = waiting
        .filter(registration => checkVisibility(registration.user?.memberships ?? [], visibility))
        .slice(0, free)
    if (promoted.length === 0) return []

    await tx.eventRegistration.updateMany({
        where: { id: { in: promoted.map(registration => registration.id) } },
        data: { state: 'IN_QUOTA', quotaId, waitingListEventId: null },
    })
    return promoted.map(({ id, userId, contact }) => ({ id, userId, contact }))
}
