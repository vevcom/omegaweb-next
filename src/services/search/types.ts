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

export type SearchSection = {
    category: SearchCategory,
    results: SearchResult[],
}
