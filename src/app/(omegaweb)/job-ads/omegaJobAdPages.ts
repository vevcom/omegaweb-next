import { CAREER_COMPANIES_PATH } from '@/app/(careers)/_lib/careersSite'
import type { JobAdPagesConfig } from '@/pageKits/jobAds/config'

/** The job ad pages of Omega's site. */
export const omegaJobAdPages: JobAdPagesConfig = {
    site: 'OMEGAWEB',
    path: '/job-ads',
    companiesPath: CAREER_COMPANIES_PATH,
}
