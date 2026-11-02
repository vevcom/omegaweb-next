import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { loginPage } from '@/pageKits/auth/pages/LoginPage'

const { page, generateMetadata } = loginPage(revueAuthPages)

export default page
export { generateMetadata }
