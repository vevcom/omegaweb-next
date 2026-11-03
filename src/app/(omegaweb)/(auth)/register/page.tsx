import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { registerPage } from '@/components/Auth/Pages/RegisterPage'

const { page, generateMetadata } = registerPage(omegaAuthPages)

export default page
export { generateMetadata }
