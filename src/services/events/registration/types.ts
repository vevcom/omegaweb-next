import type { eventRegistrationSelectionDetailed, eventRegistrationSelection } from './constants'
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

export type EventRegistrationCursor = InferPagingCursor<typeof eventRegistrationSchemas.readPage>

export type EventRegistrationPageDetails = InferPagingDetails<typeof eventRegistrationSchemas.readPage>
