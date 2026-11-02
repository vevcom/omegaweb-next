import { omegaJobAdPages } from '@/app/(omegaweb)/job-ads/omegaJobAdPages'
import { jobAdPage } from '@/pageKits/jobAds/pages/JobAdPage'

const { page, generateMetadata } = jobAdPage(omegaJobAdPages)

export default page
export { generateMetadata }
