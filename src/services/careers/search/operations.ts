import '@ow-server-only'
import { careersSearchAuth } from './auth'
import { searchOperations } from '@/services/search/operations'
import { companyOperations } from '@/services/careers/companies/operations'
import { jobAdOperations } from '@/services/careers/jobAds/operations'
import { eventOperations } from '@/services/events/operations'
import { careerJobAdPages } from '@/app/(careers)/career/job-ads/config'
import { careerEventKinds } from '@/app/(careers)/eventKinds'
import { eventHomePages } from '@/pageKits/events/homePages'
import type { careersSearchCategories } from './constants'
import type { SearchProvider } from '@/services/search/types'

/** The search of each category, the events and job ads made for the career site's own pages. */
const providers = {
    companies: companyOperations.search(),
    events: eventOperations.search(careerEventKinds.map(kind => eventHomePages[kind])),
    jobAds: jobAdOperations.search(careerJobAdPages),
} satisfies Record<typeof careersSearchCategories[number], SearchProvider>

export const careersSearchOperations = {
    searchAll: searchOperations.searchAll.implement({
        authorizer: () => careersSearchAuth.searchAll,
        // The search owns no resource of its own; the categories' searches guard theirs.
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { providers },
        operationImplementationFields: { providers },
    }),
} as const
