import type { omegaQuoteFieldsToExpose } from './constants'
import type { omegaquoteSchemas } from './schemas'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { OmegaQuote } from '@/prisma-generated-pn-types'

export type OmegaquoteFiltered = Pick<OmegaQuote, typeof omegaQuoteFieldsToExpose[number]>

export type OmegaquoteCursor = InferPagingCursor<typeof omegaquoteSchemas.params.readPage>
