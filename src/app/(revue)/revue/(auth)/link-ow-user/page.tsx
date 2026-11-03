import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { linkOwUserPage } from '@/pageKits/auth/pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(revueAuthPages)

export default page
export { generateMetadata }
