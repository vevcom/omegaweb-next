import { careerJobAdPages } from '@/app/(careers)/career/job-ads/config'
import { jobAdsPage } from '@/pageKits/jobAds/pages/JobAdsPage'

const { page, generateMetadata } = jobAdsPage(careerJobAdPages)

export default page
export { generateMetadata }
