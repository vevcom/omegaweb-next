import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { sendResetPasswordEmailPage } from '@/pageKits/auth/pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(revueAuthPages)

export default page
export { generateMetadata }
