import { CAREER_PATH } from '@/app/(careers)/_lib/careersSite'
import { jobAdPage } from '@/components/JobAds/Pages/JobAdPage'

const { page, generateMetadata } = jobAdPage(`${CAREER_PATH}/job-ads`)

export default page
export { generateMetadata }
