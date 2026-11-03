import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { verifyEmailPage } from '@/components/Auth/Pages/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
