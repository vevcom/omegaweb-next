import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { registerEmailPage } from '@/components/Auth/Pages/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(careersAuthPages)

export default page
export { generateMetadata }
