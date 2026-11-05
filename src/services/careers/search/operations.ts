import '@pn-server-only'
import { careersSearchAuth } from './auth'
import { careersSearchCategories } from './constants'
import { searchOperations } from '@/services/search/operations'

export const careersSearchOperations = {
    searchAll: searchOperations.searchAll.implement({
        authorizer: () => careersSearchAuth.searchAll,
        // The search owns no resource of its own; the categories' searches guard theirs.
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { categories: careersSearchCategories },
        operationImplementationFields: { categories: careersSearchCategories },
    }),
} as const
