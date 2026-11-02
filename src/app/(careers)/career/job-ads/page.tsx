import { careerJobAdPages } from '@/app/(careers)/_lib/careersSite'
import { jobAdsPage } from '@/pageKits/jobAds/JobAdsPage'

const { page, generateMetadata } = jobAdsPage(careerJobAdPages)

export default page
export { generateMetadata }
