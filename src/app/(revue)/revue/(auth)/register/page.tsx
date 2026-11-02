import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { registerPage } from '@/pageKits/auth/RegisterPage'

const { page, generateMetadata } = registerPage(revueAuthPages)

export default page
export { generateMetadata }
