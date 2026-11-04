import { careerJobAdPages } from '@/app/(careers)/career/job-ads/config'
import { jobAdsArchivePage } from '@/pageKits/jobAds/pages/JobAdsArchivePage'

const { page, generateMetadata } = jobAdsArchivePage(careerJobAdPages)

export default page
export { generateMetadata }
