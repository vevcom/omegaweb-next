import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { verifyEmailPage } from '@/components/Auth/Pages/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(careersAuthPages)

export default page
export { generateMetadata }
