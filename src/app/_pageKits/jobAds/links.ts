import { defineLinks } from '@/lib/sites/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { AppHref } from '@/lib/sites/href'
import type { JobAdPagesConfig } from './config'

export type JobAdLinks = {
    list: () => AppHref,
    archive: () => AppHref,
    jobAd: (jobAd: { articleName: string, id: number }) => AppHref,
}

export const jobAdLinks = defineLinks<JobAdPagesConfig, JobAdLinks>(href => ({
    list: () => href(),
    archive: () => href('/archive'),
    jobAd: jobAd => href(`/${formatVevenUri(jobAd.articleName, jobAd.id)}`),
}))
