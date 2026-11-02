import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { verifyEmailPage } from '@/pageKits/auth/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(careersAuthPages)

export default page
export { generateMetadata }
