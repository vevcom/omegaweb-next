import type { SitePages } from '@/lib/sites'

/**
 * How a site renders the job ad pages: the current job ads at the config's path, the archive at
 * `${path}/archive` and one job ad at `${path}/[nameAndId]`. Both sites show the same job ads.
 */
export type JobAdPagesConfig = SitePages & {
    /** Where the companies the job ads belong to are administered. */
    companiesPath: string,
}
