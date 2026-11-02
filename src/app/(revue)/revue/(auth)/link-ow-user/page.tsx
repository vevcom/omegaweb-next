import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { linkOwUserPage } from '@/pageKits/auth/pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(revueAuthPages)

export default page
export { generateMetadata }
