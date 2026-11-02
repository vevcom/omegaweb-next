import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { sendResetPasswordEmailPage } from '@/pageKits/auth/pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(careersAuthPages)

export default page
export { generateMetadata }
