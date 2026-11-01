import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { loginPage } from '@/components/Auth/Pages/LoginPage'

const { page, generateMetadata } = loginPage(omegaAuthPages)

export default page
export { generateMetadata }
