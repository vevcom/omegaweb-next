import '@pn-server-only'
import { omegawebSearchAuth } from './auth'
import { omegawebSearchCategories } from './constants'
import { searchOperations } from '@/services/search/operations'

export const omegawebSearchOperations = {
    searchAll: searchOperations.searchAll.implement({
        authorizer: () => omegawebSearchAuth.searchAll,
        // The search owns no resource of its own; the categories' searches guard theirs.
        ownershipCheck: () => true,
        paramsSchemaImplementationFields: { categories: omegawebSearchCategories },
        operationImplementationFields: { categories: omegawebSearchCategories },
    }),
} as const
