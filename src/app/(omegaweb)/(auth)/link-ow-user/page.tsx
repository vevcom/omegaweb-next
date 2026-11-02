import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { linkOwUserPage } from '@/pageKits/auth/pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(omegaAuthPages)

export default page
export { generateMetadata }
