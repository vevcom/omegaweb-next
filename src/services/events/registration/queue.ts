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
    const event = await prisma.event.findUniqueOrThrow({
        where: {
            id: details.eventId,
        },
        select: {
            places: true,
        },
    })

    const firstOnWaitingList = await prisma.eventRegistration.findFirst({
        where: {
            eventId: details.eventId,
        },
        orderBy: eventRegistrationQueueOrder,
        skip: event.places,
        select: {
            id: true,
        },
    })

    if (details.type === REGISTRATION_READER_TYPE.WAITING_LIST) {
        if (!firstOnWaitingList) return null

        return {
            eventId: details.eventId,
            id: { gte: firstOnWaitingList.id },
        }
    }

    // Without anyone past the places of the event, every registration took a place.
    if (!firstOnWaitingList) return { eventId: details.eventId }

    return {
        eventId: details.eventId,
        id: { lt: firstOnWaitingList.id },
    }
}
