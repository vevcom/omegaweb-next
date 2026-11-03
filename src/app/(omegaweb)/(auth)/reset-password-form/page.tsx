import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { resetPasswordFormPage } from '@/components/Auth/Pages/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(omegaAuthPages)

export default page
export { generateMetadata }
