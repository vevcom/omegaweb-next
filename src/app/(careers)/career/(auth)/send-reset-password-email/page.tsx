import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { sendResetPasswordEmailPage } from '@/pageKits/auth/pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(careersAuthPages)

export default page
export { generateMetadata }
