import { defineLinks } from '@/pageKits/defineLinks'
import { formatVevenUri } from '@/lib/urlEncoding'
import type { JobAdPagesConfig } from './config'

export type JobAdLinks = {
    list: () => string,
    archive: () => string,
    jobAd: (jobAd: { articleName: string, id: number }) => string,
    /** Where the companies are administered, outside the kit's own pages. */
    companies: () => string,
}

export const jobAdLinks = defineLinks<JobAdPagesConfig, JobAdLinks>((href, config) => ({
    list: () => href(),
    archive: () => href('/archive'),
    jobAd: jobAd => href(`/${formatVevenUri(jobAd.articleName, jobAd.id)}`),
    companies: () => config.companiesPath,
}))
