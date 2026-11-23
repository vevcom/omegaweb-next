import { revueAuthPages } from '@/app/(revue)/revue/(static-theme)/(auth)/config'
import { registerPage } from '@/pageKits/auth/pages/RegisterPage'

const { page, generateMetadata } = registerPage(revueAuthPages)

export default page
export { generateMetadata }
