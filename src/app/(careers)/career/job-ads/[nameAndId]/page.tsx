import { careerJobAdPages } from '@/app/(careers)/career/job-ads/config'
import { jobAdPage } from '@/pageKits/jobAds/pages/JobAdPage'

const { page, generateMetadata } = jobAdPage(careerJobAdPages)

export default page
export { generateMetadata }
