import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/config'
import { jobAdsArchivePage } from '@/pageKits/jobAds/pages/JobAdsArchivePage'

const { page, generateMetadata } = jobAdsArchivePage(omegaJobAdPages)

export default page
export { generateMetadata }
