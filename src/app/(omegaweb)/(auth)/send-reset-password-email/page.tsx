import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { sendResetPasswordEmailPage } from '@/components/Auth/Pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
