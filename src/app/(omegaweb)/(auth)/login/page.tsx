import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { loginPage } from '@/pageKits/auth/pages/LoginPage'

const { page, generateMetadata } = loginPage(omegaAuthPages)

export default page
export { generateMetadata }
