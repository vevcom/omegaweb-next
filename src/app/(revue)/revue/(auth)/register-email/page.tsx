import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { registerEmailPage } from '@/pageKits/auth/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(revueAuthPages)

export default page
export { generateMetadata }
