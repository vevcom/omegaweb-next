import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { verifyEmailPage } from '@/pageKits/auth/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(revueAuthPages)

export default page
export { generateMetadata }
