import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { resetPasswordFormPage } from '@/pageKits/auth/pages/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(careersAuthPages)

export default page
export { generateMetadata }
