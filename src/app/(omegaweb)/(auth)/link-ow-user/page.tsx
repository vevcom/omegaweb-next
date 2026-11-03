import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { linkOwUserPage } from '@/pageKits/auth/pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(omegaAuthPages)

export default page
export { generateMetadata }
