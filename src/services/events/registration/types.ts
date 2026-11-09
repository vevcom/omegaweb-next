import type {
    eventRegistrationAttendanceSelection,
    eventRegistrationNotAttendedSelection,
    eventRegistrationSelectionDetailed,
    eventRegistrationSelection,
    upcomingEventSelection,
} from './constants'
import type { eventRegistrationSchemas } from './schemas'
import type { ExpandedImage } from '@/services/images/subservice/types'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { Prisma } from '@/prisma-generated-pn-types'

// This type will just make sure that the image is not null
export type EventRegistrationExpanded = Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationSelection
}> & {
    image: ExpandedImage
}

export type EventRegistrationDetailedExpanded = Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationSelectionDetailed,
}>

/** A user's own registration in a variant, with whether a payment is in effect for it. */
export type EventRegistrationOfUser = Omit<Prisma.EventRegistrationGetPayload<{
    include: {
        quota: { select: { id: true, name: true, variantId: true } },
        ledgerTransactions: { select: { id: true } },
    },
}>, 'promotedAt'> & {
    variantId: number,
    paymentDeadline: Date | null,
}

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
 * `attended` and `total` only count those who got a place, so the tally reads against the size of
 * the event. Those let in from the waiting list are counted apart, in `attendedFromWaitingList`.
 */
export type EventAttendanceCounts = {
    attended: number,
    total: number,
    attendedFromWaitingList: number,
}

export type EventAttendanceRegistration = Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationAttendanceSelection
}>

export type EventAttendanceScan = {
    registration: EventAttendanceRegistration,
    counts: EventAttendanceCounts,
    alreadyAttended: boolean,
}

/** A registration whose user did not show up. The selection allows a guest's null user; this type does not. */
export type EventRegistrationNotAttended = Omit<Prisma.EventRegistrationGetPayload<{
    select: typeof eventRegistrationNotAttendedSelection
}>, 'user'> & {
    user: NonNullable<Prisma.EventRegistrationGetPayload<{
        select: typeof eventRegistrationNotAttendedSelection
    }>['user']>,
}

/** A registration of a user for an event that has not ended, with the event and the variant it is in. */
export type UpcomingRegistrationOfUser = {
    id: number,
    onWaitingList: boolean,
    variant: { id: number, name: string },
    event: Prisma.EventGetPayload<{ select: typeof upcomingEventSelection }>,
}
