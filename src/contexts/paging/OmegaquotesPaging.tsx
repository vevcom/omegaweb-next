'use client'
import { generatePaging } from '@/contexts/paging/PagingGenerator'
import { readQuotesPageAction } from '@/capabilities/omegaquotes/actions'
import type { OmegaquoteCursor, OmegaquoteFiltered } from '@/services/omegaquotes/types'

export type PageSizeOmegaquote = 20;

export const [OmegaquotePagingContext, OmegaquotePagingProvider] = generatePaging<
    OmegaquoteFiltered,
    OmegaquoteCursor,
    PageSizeOmegaquote
>({
    fetcher: async ({ paging }) => await readQuotesPageAction({ params: { paging } }),
    getCursor: ({ lastElement }) => ({ id: lastElement.id }),
})
