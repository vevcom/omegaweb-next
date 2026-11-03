import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { sendResetPasswordEmailPage } from '@/components/Auth/Pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(careersAuthPages)

export default page
export { generateMetadata }
