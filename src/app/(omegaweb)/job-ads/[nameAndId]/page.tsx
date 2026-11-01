import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/omegaJobAdPages'
import { jobAdPage } from '@/components/JobAds/Pages/JobAdPage'

const { page, generateMetadata } = jobAdPage(omegaJobAdPages)

export default page
export { generateMetadata }
