import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { sendResetPasswordEmailPage } from '@/pageKits/auth/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
