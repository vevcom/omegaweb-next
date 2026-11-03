import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/omegaJobAdPages'
import { jobAdsPage } from '@/components/JobAds/Pages/JobAdsPage'

const { page, generateMetadata } = jobAdsPage(omegaJobAdPages)

export default page
export { generateMetadata }
