import { searchCategoryNames } from '@/services/search/constants'
import type { SearchCategory } from '@/services/search/constants'

/** Omega's site has a page for everything searchable, so its search spans every category. */
export const omegawebSearchCategories: readonly SearchCategory[] = searchCategoryNames
