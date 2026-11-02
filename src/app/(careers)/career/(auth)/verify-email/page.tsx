import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { verifyEmailPage } from '@/pageKits/auth/pages/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(careersAuthPages)

export default page
export { generateMetadata }
