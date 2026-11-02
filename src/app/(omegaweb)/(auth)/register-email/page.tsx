import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { registerEmailPage } from '@/pageKits/auth/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
