import { CAREER_PATH } from '@/app/(careers)/_lib/careersSite'
import { jobAdsPage } from '@/components/JobAds/Pages/JobAdsPage'

const { page, generateMetadata } = jobAdsPage(`${CAREER_PATH}/job-ads`)

export default page
export { generateMetadata }
