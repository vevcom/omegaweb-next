import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { registerEmailPage } from '@/pageKits/auth/pages/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
