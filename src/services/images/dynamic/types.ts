import type { dynamicImageSchemas } from './schemas'
import type { InferPagingCursor, InferPagingDetails } from '@/lib/paging/schema'

export type ImageCollectionCursor = InferPagingCursor<typeof dynamicImageSchemas.params.readCollectionPage>

export type ImageCollectionPagingDetails =
    InferPagingDetails<typeof dynamicImageSchemas.params.readCollectionPage>
