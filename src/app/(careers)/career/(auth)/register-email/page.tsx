import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { registerEmailPage } from '@/pageKits/auth/pages/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(careersAuthPages)

export default page
export { generateMetadata }
