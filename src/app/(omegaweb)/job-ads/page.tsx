import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/omegaJobAdPages'
import { jobAdsPage } from '@/pageKits/jobAds/pages/JobAdsPage'

const { page, generateMetadata } = jobAdsPage(omegaJobAdPages)

export default page
export { generateMetadata }
