import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { sessionTransferPage } from '@/pageKits/auth/pages/SessionTransferPage'

const { page, generateMetadata } = sessionTransferPage(revueAuthPages)

export default page
export { generateMetadata }
