import '@pn-server-only'
import { eventRegistrationQueueOrder, REGISTRATION_READER_TYPE } from './constants'
import { takeAdvisoryLockOnId } from '@/lib/advisoryLocks'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { EventRegistrationPageDetails } from './types'

/** Where a registration stands in the queue of its event. See `eventRegistrationQueueOrder`. */
export type QueueSpot = { id: number, queuedAt: Date }

/**
 * Locks the registrations of an event for the rest of the transaction. Everything that changes who
 * holds the places of an event - registering, unregistering, moving a registration - takes this
 * lock first, so the queue it reads is the queue it changes.
 */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: number) {
    await takeAdvisoryLockOnId(tx, 'eventRegistrations', eventId)
}

/** The registrations that queue ahead of a spot in the queue. */
export function queuedAhead(spot: QueueSpot): Prisma.EventRegistrationWhereInput {
    return {
        OR: [
            { queuedAt: { lt: spot.queuedAt } },
            { queuedAt: spot.queuedAt, id: { lt: spot.id } },
        ],
    }
}

/** The registrations that queue behind a spot in the queue. */
export function queuedBehind(spot: QueueSpot): Prisma.EventRegistrationWhereInput {
    return {
        OR: [
            { queuedAt: { gt: spot.queuedAt } },
            { queuedAt: spot.queuedAt, id: { gt: spot.id } },
        ],
    }
}

/**
 * Spreads the registrations of an event that share a queue time a millisecond apart, keeping their
 * order, so every registration holds a time of its own. Run it under `lockEvent`.
 *
 * @returns The queue time of every registration of the event, by id.
 */
export async function untieQueue(tx: Prisma.TransactionClient, eventId: number): Promise<Map<number, Date>> {
    const registrations = await tx.eventRegistration.findMany({
        where: { eventId },
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

/**
 * How many registrations of the event queue ahead of a registration. A position below the places
 * of the event is a place.
 */
export async function queuePosition(
    prisma: Prisma.TransactionClient,
    registration: QueueSpot & { eventId: number },
) {
    return await prisma.eventRegistration.count({
        where: {
            eventId: registration.eventId,
            ...queuedAhead(registration),
        },
    })
}

/**
 * The two segments of the registration queue of an event: the registrations that took the places
 * of the event, and the ones queueing on the waiting list past them. The first registration past
 * the places is the boundary, and each segment is the queue on one side of it.
 *
 * @returns The filters to read each segment with. `waitingList` is null when no one is on it.
 */
export async function queueSegments(
    prisma: Prisma.TransactionClient,
    eventId: number
): Promise<{ places: Prisma.EventRegistrationWhereInput, waitingList: Prisma.EventRegistrationWhereInput | null }> {
    const { places } = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { places: true },
    })

    const boundary = await prisma.eventRegistration.findFirst({
        where: { eventId },
        orderBy: eventRegistrationQueueOrder,
        skip: places,
        select: { id: true, queuedAt: true },
    })

    if (!boundary) return { places: { eventId }, waitingList: null }

    return {
        places: { eventId, ...queuedAhead(boundary) },
        waitingList: { eventId, NOT: queuedAhead(boundary) },
    }
}

/**
 * Narrows to the segment of the registration queue the page details ask for.
 *
 * @returns The filter to read the segment with, or null if the segment holds no registrations.
 */
export async function queueSegmentFilter(
    prisma: Prisma.TransactionClient,
    details: EventRegistrationPageDetails
): Promise<Prisma.EventRegistrationWhereInput | null> {
    const segments = await queueSegments(prisma, details.eventId)
    return details.type === REGISTRATION_READER_TYPE.WAITING_LIST ? segments.waitingList : segments.places
}
