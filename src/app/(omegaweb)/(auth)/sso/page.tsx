import { omegaAuthPages } from '@/app/(omegaweb)/(auth)/config'
import { sessionTransferPage } from '@/pageKits/auth/pages/SessionTransferPage'

const { page, generateMetadata } = sessionTransferPage(omegaAuthPages)

export default page
export { generateMetadata }
