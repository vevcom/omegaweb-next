import '@pn-server-only'
import { searchAuth } from './auth'
import { searchSchemas } from './schemas'
import { defaultSearchResultLimit, searchCategoryNames, singleCategorySearchResultLimit } from './constants'
import { searchProviders } from './providers'
import { defineOperation } from '@/services/serviceOperation'
import { Smorekopp } from '@/services/error'
import type { SearchSection } from './types'

export const searchOperations = {
    /**
     * Searches every category the session may search, or only `category`. A category the session
     * may not search is left out rather than failing the whole search.
     */
    search: defineOperation({
        paramsSchema: searchSchemas.params.search,
        authorizer: () => searchAuth.search,
        operation: async ({ params }) => {
            const categories = params.category ? [params.category] : searchCategoryNames
            const limit = params.category ? singleCategorySearchResultLimit : defaultSearchResultLimit

            const sections = await Promise.all(categories.map(async (category): Promise<SearchSection | null> => {
                try {
                    return { category, results: await searchProviders[category]({ query: params.query, limit }) }
                } catch (error) {
                    if (
                        error instanceof Smorekopp &&
                        (error.errorCode === 'UNAUTHORIZED' || error.errorCode === 'UNAUTHENTICATED')
                    ) return null
                    throw error
                }
            }))
            return sections.filter(section => section !== null)
        }
    }),
} as const
