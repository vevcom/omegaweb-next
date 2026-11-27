import type { omegaQuoteFieldsToExpose } from './constants'
import type { omegaquoteContract } from './contract'
import type { InferPagingCursor } from '@/lib/paging/schema'
import type { OmegaQuote } from '@/prisma-generated-pn-types'

export type OmegaquoteFiltered = Pick<OmegaQuote, typeof omegaQuoteFieldsToExpose[number]>

export type OmegaquoteCursor = InferPagingCursor<typeof omegaquoteContract.readPage.params>
