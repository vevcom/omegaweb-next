import '@pn-server-only'
import { eventRegistrationQueueOrder, REGISTRATION_READER_TYPE } from './constants'
import { takeAdvisoryLockOnId } from '@/lib/advisoryLocks'
import type { Prisma } from '@/prisma-generated-pn-types'
import type { EventRegistrationPageDetails } from './types'

/**
 * Locks the registrations of an event for the rest of the transaction. Everything that changes who
 * holds the places of an event - registering, unregistering - takes this lock first, so the queue
 * it reads is the queue it changes.
 */
export async function lockEvent(tx: Prisma.TransactionClient, eventId: number) {
    await takeAdvisoryLockOnId(tx, 'eventRegistrations', eventId)
}

/**
 * How many registrations of the event queue ahead of a registration. The queue is ordered by id,
 * so these are the ones with a lower id. A position below the places of the event is a place.
 */
export async function queuePosition(
    prisma: Prisma.TransactionClient,
    registration: { id: number, eventId: number },
) {
    return await prisma.eventRegistration.count({
        where: {
            eventId: registration.eventId,
            id: { lt: registration.id },
        },
    })
}

/**
 * The id of the first registration past the places of an event, or null when there is none. The
 * queue is ordered by id, so ids below it hold places and the rest are on the waiting list.
 */
export async function firstOnWaitingList(
    prisma: Prisma.TransactionClient,
    eventId: number
): Promise<number | null> {
    const { places } = await prisma.event.findUniqueOrThrow({
        where: { id: eventId },
        select: { places: true },
    })

    const first = await prisma.eventRegistration.findFirst({
        where: { eventId },
        orderBy: eventRegistrationQueueOrder,
        skip: places,
        select: { id: true },
    })

    return first?.id ?? null
}

/**
 * Narrows to one segment of the registration queue of an event: the registrations that took the
 * places of the event, or the ones queueing on the waiting list past them. The first registration
 * past the places is the boundary, and since the queue is ordered by id, each segment is simply the
 * ids on one side of it.
 *
 * @returns The filter to read the segment with, or null if the segment holds no registrations.
 */
export async function queueSegmentFilter(
    prisma: Prisma.TransactionClient,
    details: EventRegistrationPageDetails
): Promise<Prisma.EventRegistrationWhereInput | null> {
    const boundary = await firstOnWaitingList(prisma, details.eventId)

    if (details.type === REGISTRATION_READER_TYPE.WAITING_LIST) {
        if (!boundary) return null

        return { eventId: details.eventId, id: { gte: boundary } }
    }

    // Without anyone past the places of the event, every registration took a place.
    if (!boundary) return { eventId: details.eventId }

    return { eventId: details.eventId, id: { lt: boundary } }
}
