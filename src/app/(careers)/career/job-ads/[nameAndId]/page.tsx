import { careerJobAdPages } from '@/app/(careers)/_lib/careersSite'
import { jobAdPage } from '@/pageKits/jobAds/JobAdPage'

const { page, generateMetadata } = jobAdPage(careerJobAdPages)

export default page
export { generateMetadata }
