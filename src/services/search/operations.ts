import '@pn-server-only'
import { searchSchemas } from './schemas'
import { defaultSearchResultLimit, singleCategorySearchResultLimit } from './constants'
import { defineSubOperation } from '@/services/serviceOperation'
import { Smorekopp } from '@/services/error'
import type { SearchCategory } from './constants'
import type { SearchAllFields, SearchSection } from './types'

export const searchOperations = {
    /**
     * Searches every category the session may search among those the implementation includes, or
     * only `category`. A site implements it with the categories it has pages for. A category the
     * session may not search is left out rather than failing the whole search.
     */
    searchAll: defineSubOperation({
        paramsSchema: ({ providers }: SearchAllFields) => searchSchemas.params.searchAll.refine(
            params => !params.category || params.category in providers,
            { message: 'Kategorien finnes ikke i dette søket.', path: ['category'] },
        ),
        operation: ({ providers }: SearchAllFields) => async ({ params }) => {
            const searched = Object.entries(providers)
                .filter(([category]) => !params.category || category === params.category)
                .map(([category, provider]) => ({ category: category as SearchCategory, provider }))
            const limit = params.category ? singleCategorySearchResultLimit : defaultSearchResultLimit

            const sections = await Promise.all(searched.map(async ({
                category, provider
            }): Promise<SearchSection | null> => {
                try {
                    const { searchResults } = await provider({ params: { query: params.query, limit } })
                    return { category, results: searchResults }
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
