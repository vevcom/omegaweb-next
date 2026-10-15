import type {
    eventRegistrationAttendanceSelection,
    eventRegistrationSelectionDetailed,
    eventRegistrationSelection,
} from './constants'
import type { eventRegistrationSchemas } from './schemas'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { EventRegistration, Prisma } from '@/prisma-generated-pn-types'

// This type will just make sure that the image is not null
export type EventRegistrationExpanded = Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationSelection
}> & {
    image: ExpandedImage
}

/**
 * A registration together with wether it landed on the waiting list of the event - i.e. wether it
 * queues past the places of the event. See `eventRegistrationQueueOrder` for the queue it is in.
 */
export type EventRegistrationWithWaitingList = EventRegistration & {
    onWaitingList: boolean,
}

export type EventRegistrationDetailedExpanded = Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationSelectionDetailed,
}>

/**
 * What the dots of a user hold them back from when registering to an event. A timeout means the user
 * must wait that many minutes past the ordinary registration start of the event.
 */
export type DotPunishment = {
    type: 'none',
} | {
    type: 'timeout',
    punishmentMinutes: number,
} | {
    type: 'ban',
}

export type EventRegistrationCursor = InferPagingCursor<typeof eventRegistrationSchemas.params.readPage>

export type EventRegistrationPageDetails = InferPagingDetails<typeof eventRegistrationSchemas.params.readPage>

/**
 * How many of the ones registered for an event have had attendance taken for them.
 *
 * `attended` and `total` are about the ones that took the places of the event, so the tally reads
 * against the size the event was planned for - counting the waiting list into `total` would say 70
 * of an event with 50 places and 20 queueing. Someone on the waiting list who is let in at the door
 * did still show up, so they are counted too, but apart, in `attendedFromWaitingList`.
 */
export type EventAttendanceCounts = {
    attended: number,
    total: number,
    attendedFromWaitingList: number,
}

/**
 * One registration as the attendance tools read it back.
 */
export type EventAttendanceRegistration = Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationAttendanceSelection
}>

/**
 * The outcome of one scan at the door, which also tells whether attendance had already been taken
 * for the registration - a second scan of the same Omega-ID is not an error, but worth saying out
 * loud, so nobody is counted twice over in the head of the one holding the scanner.
 */
export type EventAttendanceScan = {
    registration: EventAttendanceRegistration,
    counts: EventAttendanceCounts,
    alreadyAttended: boolean,
}
