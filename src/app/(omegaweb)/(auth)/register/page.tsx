import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { registerPage } from '@/pageKits/auth/pages/RegisterPage'

const { page, generateMetadata } = registerPage(omegaAuthPages)

export default page
export { generateMetadata }
