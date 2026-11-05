import type { SearchCategory } from '@/services/search/constants'

/** The career site has pages for companies and job ads, so its search spans those. */
export const careersSearchCategories: readonly SearchCategory[] = ['companies', 'jobAds']
