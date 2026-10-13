import type { newsArticleRealtionsIncluder } from './constants'
import type { newsSchemas } from './schemas'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { NewsArticle, Prisma } from '@/prisma-generated-pn-types'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type ExpandedNewsArticle = Prisma.NewsArticleGetPayload<{
    include: typeof newsArticleRealtionsIncluder
}>

//used for read many actions
export type SimpleNewsArticle = NewsArticle & {
    coverImage: ExpandedImage | null
}

export type NewsCursor = InferPagingCursor<typeof newsSchemas.params.readOldPage>
