import '@pn-server-only'
import { omegawebSearchAuth } from './auth'
import { searchOperations } from '@/services/search/operations'
import { userOperations } from '@/services/users/operations'
import { eventOperations } from '@/services/events/operations'
import { committeeOperations } from '@/services/groups/committees/operations'
import { interestGroupOperations } from '@/services/groups/interestGroups/operations'
import { newsOperations } from '@/services/news/operations'
import { companyOperations } from '@/services/careers/companies/operations'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/config'
import { omegaEventPages } from '@/app/(omegaweb)/events/config'
import type { omegawebSearchCategories } from './constants'
import type { SearchProvider } from '@/services/search/types'

/** The search of each category, the events and job ads made for Omega's own pages. */
const providers = {
    users: userOperations.search(),
    events: eventOperations.search(omegaEventPages),
    committees: committeeOperations.search(),
    interestGroups: interestGroupOperations.search(),
    news: newsOperations.search(),
    companies: companyOperations.search(),
    jobAds: jobAdOperations.search(omegaJobAdPages),
} satisfies Record<typeof omegawebSearchCategories[number], SearchProvider>

export const omegawebSearchOperations = {
    searchAll: searchOperations.searchAll.implement({
        authorizer: () => omegawebSearchAuth.searchAll,
        // The search owns no resource of its own; the categories' searches guard theirs.
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { providers },
        operationImplementationFields: { providers },
    }),
} as const
