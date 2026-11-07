'use client'
import { defineGlobalSearch } from '@/components/GlobalSearch/GlobalSearch'
import { careersSearchAllAction } from '@/services/careers/search/actions'

/** The global search of the career site, on its own `searchAll`, which spans what the site has pages for. */
const careersGlobalSearch = defineGlobalSearch({
    action: careersSearchAllAction,
    placeholder: 'Søk etter bedrifter, jobbannonser og sider...',
})

export const CareersGlobalSearchProvider = careersGlobalSearch.GlobalSearchProvider
export const useCareersGlobalSearch = careersGlobalSearch.useGlobalSearch
export const CareersSearchButton = careersGlobalSearch.SearchButton
export const CareersGlobalSearch = careersGlobalSearch.GlobalSearch
