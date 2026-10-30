import '@pn-server-only'
import { eventRegistrationQueueOrder, REGISTRATION_READER_TYPE } from './constants'
import { takeAdvisoryLockOnId } from '@/lib/advisoryLocks'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { EventRegistrationPageDetails } from './types'

/** Where a registration stands on the waiting list. See `eventRegistrationQueueOrder`. */
export type QueueSpot = { id: number, queuedAt: Date }

/**
 * Locks the registrations of an event for the rest of the transaction. Everything that changes who
 * holds the places of an event - registering, unregistering, moving a registration, resizing a quota
 * - takes this lock first, so the places it reads are the places it changes.
 */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: number) {
    await takeAdvisoryLockOnId(tx, 'eventRegistrations', eventId)
}

/** Every registration of an event: those holding a place in one of its quotas and those on its waiting list. */
export function registrationsOfEvent(eventId: number): Prisma.EventRegistrationWhereInput {
    return { OR: [{ quota: { eventId } }, { waitingListEventId: eventId }] }
}

export function seatedInEvent(eventId: number): Prisma.EventRegistrationWhereInput {
    return { state: 'IN_QUOTA', quota: { eventId } }
}

export function waitingInEvent(eventId: number): Prisma.EventRegistrationWhereInput {
    return { state: 'WAITING_LIST', waitingListEventId: eventId }
}

/** The registrations that queue ahead of a spot on the waiting list. */
export function queuedAhead(spot: QueueSpot): Prisma.EventRegistrationWhereInput {
    return {
        OR: [
            { queuedAt: { lt: spot.queuedAt } },
            { queuedAt: spot.queuedAt, id: { lt: spot.id } },
        ],
    }
}

/** The registrations that queue behind a spot on the waiting list. */
export function queuedBehind(spot: QueueSpot): Prisma.EventRegistrationWhereInput {
    return {
        OR: [
            { queuedAt: { gt: spot.queuedAt } },
            { queuedAt: spot.queuedAt, id: { gt: spot.id } },
        ],
    }
}

/**
 * Spreads the registrations on the waiting list of an event that share a queue time a millisecond
 * apart, keeping their order, so every one holds a time of its own. Run it under `lockEvent`.
 *
 * @returns The queue time of every registration on the waiting list, by id.
 */
export async function untieQueue(tx: Prisma.TransactionClient, eventId: number): Promise<Map<number, Date>> {
    const registrations = await tx.eventRegistration.findMany({
        where: waitingInEvent(eventId),
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

/** The segment of the registrations of an event the page details ask for: those with a place, or the waiting list. */
export function queueSegmentFilter(details: EventRegistrationPageDetails): Prisma.EventRegistrationWhereInput {
    return details.type === REGISTRATION_READER_TYPE.WAITING_LIST
        ? waitingInEvent(details.eventId)
        : seatedInEvent(details.eventId)
}

/** Those with a place list by quota, then by when they registered; the waiting list by its queue. */
export function queueSegmentOrder(type: REGISTRATION_READER_TYPE): Prisma.EventRegistrationOrderByWithRelationInput[] {
    return type === REGISTRATION_READER_TYPE.WAITING_LIST
        ? eventRegistrationQueueOrder
        : [{ quota: { order: 'asc' } }, { createdAt: 'asc' }, { id: 'asc' }]
}
