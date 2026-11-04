import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { resetPasswordFormPage } from '@/pageKits/auth/pages/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(careersAuthPages)

export default page
export { generateMetadata }
