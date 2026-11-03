import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { linkOwUserPage } from '@/pageKits/auth/pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(careersAuthPages)

export default page
export { generateMetadata }
