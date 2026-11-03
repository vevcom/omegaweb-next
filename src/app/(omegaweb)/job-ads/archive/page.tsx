import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/omegaJobAdPages'
import { jobAdsArchivePage } from '@/components/JobAds/Pages/JobAdsArchivePage'

const { page, generateMetadata } = jobAdsArchivePage(omegaJobAdPages)

export default page
export { generateMetadata }
