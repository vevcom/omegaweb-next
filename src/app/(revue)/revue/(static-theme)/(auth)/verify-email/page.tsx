import { revueAuthPages } from '@/app/(revue)/revue/(static-theme)/(auth)/config'
import { verifyEmailPage } from '@/pageKits/auth/pages/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(revueAuthPages)

export default page
export { generateMetadata }
