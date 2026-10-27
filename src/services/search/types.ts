import type { SearchCategory } from './constants'
import type { ExpandedImage } from '@/services/images/subservice/types'

export type SearchResult = {
    key: string,
    href: string,
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
