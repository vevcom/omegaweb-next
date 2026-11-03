import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { linkOwUserPage } from '@/components/Auth/Pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(omegaAuthPages)

export default page
export { generateMetadata }
