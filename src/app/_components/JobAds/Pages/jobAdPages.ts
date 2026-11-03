import { formatVevenUri } from '@/lib/urlEncoding'
import type { SitePages } from '@/lib/sites'

/**
 * How a site renders the job ad pages: the current job ads at the config's path, the archive at
 * `${path}/archive` and one job ad at `${path}/[nameAndId]`. Both sites show the same job ads.
 */
export type JobAdPagesConfig = SitePages

/** The page of one job ad under `basePath`. */
export function jobAdHref(basePath: string, jobAd: { articleName: string, id: number }): string {
    return `${basePath}/${formatVevenUri(jobAd.articleName, jobAd.id)}`
}
