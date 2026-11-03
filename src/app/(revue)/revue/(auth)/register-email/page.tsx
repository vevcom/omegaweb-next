import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { registerEmailPage } from '@/pageKits/auth/pages/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(revueAuthPages)

export default page
export { generateMetadata }
