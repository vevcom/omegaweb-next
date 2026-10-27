import '@pn-server-only'
import { userOperations } from '@/services/users/operations'
import { eventOperations } from '@/services/events/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { interestGroupOperations } from '@/services/groups/interestGroups/operations'
import { newsOperations } from '@/services/news/operations'
import { companyOperations } from '@/services/careers/companies/operations'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import type { SearchCategory } from './constants'
import type { SearchReturn } from './types'
import type { searchSchemas } from './schemas'
import type { z } from 'zod'

type SearchProvider = (args: { params: z.input<typeof searchSchemas.params.search> }) => Promise<SearchReturn<unknown>>

/**
 * The `search` operation of each category, as `implementSearchOperation` shapes them. It decides
 * whether the session may search the category and how its rows are shown.
 */
export const searchProviders: Record<SearchCategory, SearchProvider> = {
    users: userOperations.search,
    events: eventOperations.search,
    committees: committeeOperations.search,
    interestGroups: interestGroupOperations.search,
    news: newsOperations.search,
    companies: companyOperations.search,
    jobAds: jobAdOperations.search,
}
