import type { PagesMount } from '@/lib/sites/defineLinks'

/**
 * How a site renders the job ad pages: the current job ads at the mount path, the archive at
 * `${mountPath}/archive` and one job ad at `${mountPath}/[nameAndId]`. Both sites show the same job ads.
 */
export type JobAdPagesConfig = PagesMount
