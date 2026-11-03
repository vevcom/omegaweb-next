import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { sessionTransferPage } from '@/pageKits/auth/pages/SessionTransferPage'

const { page, generateMetadata } = sessionTransferPage(careersAuthPages)

export default page
export { generateMetadata }
