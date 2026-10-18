import type { eventCompanySelection, eventFilterSelection } from './constants'
import type { eventSchemas } from './schemas'
import type { ExpandedCmsImage } from '@/cms/images/types'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'
import type { EventTag, Prisma } from '@/prisma-generated-pn-types'


/**
 * The raw `_count` of registrations is not exposed - `numOfRegistrations` (how many took the places
 * of the event) and `numOnWaitingList` (how many queue past them) are the numbers to read.
 */
export type EventFiltered = Omit<Prisma.EventGetPayload<{
    select: typeof eventFilterSelection
}>, '_count'> & {
    numOfRegistrations: number,
    numOnWaitingList: number,
}

export type EventExpanded = EventFiltered & {
    coverImage: Pick<ExpandedCmsImage, 'image'>
    tags: EventTag[],
}

export type CompanyOfEvent = Prisma.CompanyGetPayload<{ select: typeof eventCompanySelection }>

export type EventArchiveCursor = InferPagingCursor<typeof eventSchemas.params.readManyArchivedPage>

export type EventArchiveDetails = InferPagingDetails<typeof eventSchemas.params.readManyArchivedPage>
