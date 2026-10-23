'use client'
import { generatePaging } from './PagingGenerator'
import { readInactiveJobAdsPageAction } from '@/services/careers/jobAds/actions'
import type { JobAdInactiveCursor, JobAdInactiveDetails, SimpleJobAd } from '@/services/careers/jobAds/types'

export type PageSizeJobAdInactive = 12

export const [JobAdInactivePagingContext, JobAdInactivePagingProvider] = generatePaging<
    SimpleJobAd,
    JobAdInactiveCursor,
    PageSizeJobAdInactive,
    JobAdInactiveDetails
>({
    fetcher: async ({ paging }) => await readInactiveJobAdsPageAction({ params: { paging } }),
    getCursor: ({ lastElement }) => ({ id: lastElement.id }),
})
