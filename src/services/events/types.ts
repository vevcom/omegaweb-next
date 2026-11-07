import type { eventFilterSelection, eventQuotaSummarySelection, eventVariantSummarySelection } from './constants'
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
    creatorId: number | null,
    quotaVisibilities: VisibilityMatrix[],
}

export type EventQuotaSummary = Omit<Prisma.EventQuotaGetPayload<{
    select: typeof eventQuotaSummarySelection
}>, '_count'> & {
    numOfRegistrations: number,
}

/** A variant with what its quotas add up to. It takes registration when a quota of it has places. */
export type EventVariantSummary = Omit<Prisma.EventVariantGetPayload<{
    select: typeof eventVariantSummarySelection
}>, '_count' | 'quotas'> & {
    quotas: EventQuotaSummary[],
    takesRegistration: boolean,
    places: number,
    numOfRegistrations: number,
    numOnWaitingList: number,
}

/**
 * An event with what its variants add up to: it takes registration when one of them does, its
 * places and registrations are their sums, and its registration period spans theirs.
 */
export type EventFiltered = Omit<Prisma.EventGetPayload<{
    select: typeof eventFilterSelection
}>, 'variants'> & {
    variants: EventVariantSummary[],
    takesRegistration: boolean,
    takesPayment: boolean,
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
