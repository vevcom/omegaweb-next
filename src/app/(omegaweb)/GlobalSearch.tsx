'use client'
import { defineGlobalSearch } from '@/components/GlobalSearch/GlobalSearch'
import { omegawebSearchAllAction } from '@/services/omegawebSearch/actions'

/** The global search of Omega's site, on its own `searchAll`, which spans every category. */
const omegaGlobalSearch = defineGlobalSearch({
    action: omegawebSearchAllAction,
    placeholder: 'Søk etter brukere, arrangementer, komitéer, nyheter og sider...',
})

export const OmegaGlobalSearchProvider = omegaGlobalSearch.GlobalSearchProvider
export const useOmegaGlobalSearch = omegaGlobalSearch.useGlobalSearch
export const OmegaSearchButton = omegaGlobalSearch.SearchButton
export const OmegaGlobalSearch = omegaGlobalSearch.GlobalSearch
