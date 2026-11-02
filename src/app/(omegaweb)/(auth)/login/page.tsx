import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { loginPage } from '@/pageKits/auth/pages/LoginPage'

const { page, generateMetadata } = loginPage(omegaAuthPages)

export default page
export { generateMetadata }
