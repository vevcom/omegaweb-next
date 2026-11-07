import type { SearchCategory } from './constants'
import type { z } from 'zod'
import type { searchSchemas } from './schemas'
import type { Action } from '@/services/actionTypes'
import type { AppHref } from '@/lib/sites/href'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type SearchResult = {
    key: string,
    href: AppHref,
    label: string,
    sublabel?: string,
    /** Shown as the thumbnail. Without one, the category's icon is shown. */
    image: ExpandedImage | null,
}

/** What the `search` operation of every service returns: its rows, and the same rows as results. */
export type SearchReturn<Row> = {
    rows: Row[],
    searchResults: SearchResult[],
}

export type SearchSection = {
    category: SearchCategory,
    results: SearchResult[],
}

/** The `search` operation of a category, as `implementSearchOperation` shapes it. */
export type SearchProvider = (
    args: { params: z.input<typeof searchSchemas.params.search> }
) => Promise<SearchReturn<unknown>>

/**
 * What a site's implementation of `searchAll` is built from: the categories it has pages for, each
 * with the search whose results link to that site's pages. A category not here is not searched.
 */
export type SearchAllFields = {
    providers: Partial<Record<SearchCategory, SearchProvider>>,
}

/** A site's `searchAll` action, which the global search takes whichever site it is on. */
export type SearchAllAction = Action<SearchSection[], undefined, typeof searchSchemas.params.searchAll, undefined>
