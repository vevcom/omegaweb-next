import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { resetPasswordFormPage } from '@/pageKits/auth/pages/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(omegaAuthPages)

export default page
export { generateMetadata }
