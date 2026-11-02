import { careerJobAdPages } from '@/app/(careers)/_lib/careersSite'
import { jobAdsArchivePage } from '@/pageKits/jobAds/JobAdsArchivePage'

const { page, generateMetadata } = jobAdsArchivePage(careerJobAdPages)

export default page
export { generateMetadata }
