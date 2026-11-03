import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/omegaAuthPages'
import { registerEmailPage } from '@/components/Auth/Pages/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(omegaAuthPages)

export default page
export { generateMetadata }
