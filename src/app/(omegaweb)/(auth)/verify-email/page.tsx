import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { verifyEmailPage } from '@/pageKits/auth/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
