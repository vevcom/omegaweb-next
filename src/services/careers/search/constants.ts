import type { SearchCategory } from '@/services/search/constants'

/** The career site has pages for companies, company presentations and job ads, so its search spans those. */
export const careersSearchCategories = ['companies', 'events', 'jobAds'] as const satisfies readonly SearchCategory[]
