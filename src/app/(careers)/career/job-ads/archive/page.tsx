import { careerJobAdPages } from '@/app/(careers)/_lib/careersSite'
import { jobAdsArchivePage } from '@/components/JobAds/Pages/JobAdsArchivePage'

const { page, generateMetadata } = jobAdsArchivePage(careerJobAdPages)

export default page
export { generateMetadata }
