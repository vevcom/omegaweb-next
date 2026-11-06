import '@pn-server-only'
import { eventRegistrationQueueOrder, REGISTRATION_READER_TYPE } from './constants'
import { takeAdvisoryLockOnId } from '@/lib/advisoryLocks'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { EventRegistrationPageDetails } from './types'

export type QueueSpot = { id: number, queuedAt: Date }

/**
 * Locks the registrations of an event for the rest of the transaction. Everything that changes who
 * holds a place takes this lock first, so the places it reads are the places it changes.
 */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: number) {
    await takeAdvisoryLockOnId(tx, 'eventRegistrations', eventId)
}

export function registrationsOfEvent(eventId: number): Prisma.EventRegistrationWhereInput {
    return { OR: [{ quota: { variant: { eventId } } }, { waitingListVariant: { eventId } }] }
}

export function registrationsOfVariant(variantId: number): Prisma.EventRegistrationWhereInput {
    return { OR: [{ quota: { variantId } }, { waitingListVariantId: variantId }] }
}

export function seatedInEvent(eventId: number): Prisma.EventRegistrationWhereInput {
    return { state: 'IN_QUOTA', quota: { variant: { eventId } } }
}

export function waitingInEvent(eventId: number): Prisma.EventRegistrationWhereInput {
    return { state: 'WAITING_LIST', waitingListVariant: { eventId } }
}

export function waitingInVariant(variantId: number): Prisma.EventRegistrationWhereInput {
    return { state: 'WAITING_LIST', waitingListVariantId: variantId }
}

export function queuedAhead(spot: QueueSpot): Prisma.EventRegistrationWhereInput {
    return {
        OR: [
            { queuedAt: { lt: spot.queuedAt } },
            { queuedAt: spot.queuedAt, id: { lt: spot.id } },
        ],
    }
}

export function queuedBehind(spot: QueueSpot): Prisma.EventRegistrationWhereInput {
    return {
        OR: [
            { queuedAt: { gt: spot.queuedAt } },
            { queuedAt: spot.queuedAt, id: { gt: spot.id } },
        ],
    }
}

/**
 * Spreads the registrations on the waiting list of a variant that share a queue time a millisecond
 * apart, keeping their order. Run it under `lockEvent`.
 */
export async function untieQueue(tx: Prisma.TransactionClient, variantId: number): Promise<Map<number, Date>> {
    const registrations = await tx.eventRegistration.findMany({
        where: waitingInVariant(variantId),
        orderBy: eventRegistrationQueueOrder,
        select: { id: true, queuedAt: true },
    })

    const times = new Map<number, Date>()
    let previous: Date | null = null
    for (const registration of registrations) {
        let queuedAt = registration.queuedAt
        if (previous && queuedAt.getTime() <= previous.getTime()) {
            queuedAt = new Date(previous.getTime() + 1)
            await tx.eventRegistration.update({ where: { id: registration.id }, data: { queuedAt } })
        }
        times.set(registration.id, queuedAt)
        previous = queuedAt
    }
    return times
}

/** A segment of the queue, optionally of one variant, and narrowed to those matching every word of a search. */
export function queueSegmentFilter({
    eventId,
    type,
    variantId,
    search,
}: EventRegistrationPageDetails): Prisma.EventRegistrationWhereInput {
    const waiting = type === REGISTRATION_READER_TYPE.WAITING_LIST
    const words = search?.split(/\s+/).filter(Boolean) ?? []
    const contains = (word: string) => ({ contains: word, mode: 'insensitive' as const })

    return {
        AND: [
            waiting ? waitingInEvent(eventId) : seatedInEvent(eventId),
            ...(variantId === undefined ? [] : [
                waiting ? { waitingListVariantId: variantId } : { quota: { variantId } },
            ]),
            ...words.map(word => ({
                OR: [
                    { user: { firstname: contains(word) } },
                    { user: { lastname: contains(word) } },
                    { user: { username: contains(word) } },
                    { contact: { name: contains(word) } },
                ],
            })),
        ],
    }
}

/** Those with a place list by variant, quota and queue; the waiting lists by variant and queue. */
export function queueSegmentOrder(type: REGISTRATION_READER_TYPE): Prisma.EventRegistrationOrderByWithRelationInput[] {
    return type === REGISTRATION_READER_TYPE.WAITING_LIST
        ? [{ waitingListVariant: { order: 'asc' } }, ...eventRegistrationQueueOrder]
        : [{ quota: { variant: { order: 'asc' } } }, { quota: { order: 'asc' } }, ...eventRegistrationQueueOrder]
}
