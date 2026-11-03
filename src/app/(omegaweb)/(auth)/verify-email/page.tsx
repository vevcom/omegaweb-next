import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { verifyEmailPage } from '@/pageKits/auth/pages/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
