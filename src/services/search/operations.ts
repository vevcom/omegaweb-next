import '@pn-server-only'
import { searchSchemas } from './schemas'
import { defaultSearchResultLimit, singleCategorySearchResultLimit } from './constants'
import { searchProviders } from './providers'
import { defineSubOperation } from '@/services/serviceOperation'
import { Smorekopp } from '@/services/error'
import type { SearchAllFields, SearchSection } from './types'

export const searchOperations = {
    /**
     * Searches every category the session may search among those the implementation includes, or
     * only `category`. A site implements it with the categories it has pages for. A category the
     * session may not search is left out rather than failing the whole search.
     */
    searchAll: defineSubOperation({
        paramsSchema: ({ categories }: SearchAllFields) => searchSchemas.params.searchAll.refine(
            params => !params.category || categories.includes(params.category),
            { message: 'Kategorien finnes ikke i dette søket.', path: ['category'] },
        ),
        operation: ({ categories }: SearchAllFields) => async ({ params }) => {
            const searched = params.category ? [params.category] : categories
            const limit = params.category ? singleCategorySearchResultLimit : defaultSearchResultLimit

            const sections = await Promise.all(searched.map(async (category): Promise<SearchSection | null> => {
                try {
                    const { searchResults } = await searchProviders[category]({ params: { query: params.query, limit } })
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
