import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { sendResetPasswordEmailPage } from '@/pageKits/auth/pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
