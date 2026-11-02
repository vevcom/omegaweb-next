import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { resetPasswordFormPage } from '@/pageKits/auth/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(omegaAuthPages)

export default page
export { generateMetadata }
