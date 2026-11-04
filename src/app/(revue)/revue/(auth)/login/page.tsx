import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { loginPage } from '@/pageKits/auth/pages/LoginPage'

const { page, generateMetadata } = loginPage(revueAuthPages)

export default page
export { generateMetadata }
