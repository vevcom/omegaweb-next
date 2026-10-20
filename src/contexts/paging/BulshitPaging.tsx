'use client'
import { generatePaging } from '@/contexts/paging/PagingGenerator'
import { readBulshitPageAction } from '@/services/bulshit/actions'
import type { BulshitCursor, BulshitFiltered } from '@/services/bulshit/types'

export type PageSizeBulshit = 20;

export const [BulshitPagingContext, BulshitPagingProvider] = generatePaging<
    BulshitFiltered,
    BulshitCursor,
    PageSizeBulshit
>({
    fetcher: async ({ paging }) => await readBulshitPageAction({ params: { paging } }),
    getCursor: ({ lastElement }) => ({ id: lastElement.id }),
})
