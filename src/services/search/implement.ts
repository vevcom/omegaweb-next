import '@pn-server-only'
import { searchSchemas } from './schemas'
import { defineOperation } from '@/services/serviceOperation'
import type { SearchResult, SearchReturn } from './types'
import type { AuthorizerGetter, PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { Awaitable } from '@/lib/awaitable'

export type SearchFindArgs<PrismaWhereFilter extends object | undefined, Config = void> = {
    prisma: PrismaPossibleTransaction<boolean>,
    /** What to match, trimmed. Empty narrows nothing, so every row is then a match. */
    query: string,
    /** How many rows at most, or every match when the caller gave no limit. */
    take: number | undefined,
    /** What the authorizer attached, such as the filter of `Require.visibilityFilter()`. */
    prismaWhereFilter: PrismaWhereFilter | undefined,
    /** What the operation was made for, such as the page-kit config of the site searching. */
    config: Config,
}

/**
 * The `search` operation of a service: the rows matching a free text query, for a page narrowing
 * its list, and the same rows as search results, for the global search. Every service implements
 * it with the same params, `query` and an optional `limit`, so the global search calls them all
 * alike. `find` is the service's own and the one place its matching rule lives, and
 * `toSearchResult` is how the service shows up in the global search. A page passes its search
 * box through as it is and no limit: an empty query narrows nothing, and without a limit every
 * match is returned. The global search always has a query and passes a limit.
 *
 * The operation is made for a config, which `find` and `toSearchResult` get: a service with pages
 * on several sites takes the page-kit config of the site, so the results link to its pages and
 * match only what it shows. A service with nothing to vary takes no config, and is called with `()`.
 */
export function implementSearchOperation<Row, Config = void, PrismaWhereFilter extends object | undefined = undefined>({
    authorizer,
    find,
    toSearchResult,
}: {
    authorizer: AuthorizerGetter<
        boolean, typeof searchSchemas.params.search, undefined, undefined, PrismaWhereFilter | undefined
    >,
    find: (args: SearchFindArgs<PrismaWhereFilter, Config>) => Awaitable<Row[]>,
    toSearchResult: (row: Row, config: Config) => SearchResult,
}) {
    return (config: Config) => defineOperation({
        paramsSchema: searchSchemas.params.search,
        authorizer,
        operation: async ({ prisma, params }, prismaWhereFilter): Promise<SearchReturn<Row>> => {
            const rows = await find({
                prisma,
                query: params.query,
                take: params.limit,
                prismaWhereFilter,
                config,
            })
            return { rows, searchResults: rows.map(row => toSearchResult(row, config)) }
        },
    })
}
