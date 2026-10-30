import type { eventFilterSelection, eventQuotaSummarySelection } from './constants'
import type { eventSchemas } from './schemas'
import type { ExpandedCmsImage } from '@/cms/images/types'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { VisibilityMatrix } from '@/services/visibility/types'
import type { EventCanView, EventTag, Prisma } from '@/prisma-generated-pn-types'

/** What the rules of eventAuth need to know about one event; see `readEventAccess`. */
export type EventAccess = {
    published: boolean,
    canBeViewedBy: EventCanView,
    adminVisibility: VisibilityMatrix,
    quotaVisibilities: VisibilityMatrix[],
}

export type EventQuotaSummary = Omit<Prisma.EventRegistrationQuotaGetPayload<{
    select: typeof eventQuotaSummarySelection
}>, '_count'> & {
    numOfRegistrations: number,
}

/**
 * An event with what its quotas add up to: it takes registration when it has any, its places and
 * registrations are their sums, and its registration period spans theirs.
 */
export type EventFiltered = Omit<Prisma.EventGetPayload<{
    select: typeof eventFilterSelection
}>, '_count' | 'quotas'> & {
    quotas: EventQuotaSummary[],
    takesRegistration: boolean,
    places: number,
    numOfRegistrations: number,
    numOnWaitingList: number,
    registrationStart: Date | null,
    registrationEnd: Date | null,
}

export type EventExpanded = EventFiltered & {
    coverImage: Pick<ExpandedCmsImage, 'image'>
    tags: EventTag[],
}

export type EventArchiveCursor = InferPagingCursor<typeof eventSchemas.params.readManyArchivedPage>

export type EventArchiveDetails = InferPagingDetails<typeof eventSchemas.params.readManyArchivedPage>
