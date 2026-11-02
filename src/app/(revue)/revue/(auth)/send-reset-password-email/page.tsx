import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { sendResetPasswordEmailPage } from '@/pageKits/auth/pages/SendResetPasswordEmailPage'

const { page, generateMetadata } = sendResetPasswordEmailPage(revueAuthPages)

export default page
export { generateMetadata }
