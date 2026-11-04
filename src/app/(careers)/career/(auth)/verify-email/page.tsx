import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { verifyEmailPage } from '@/pageKits/auth/pages/VerifyEmailPage'

const { page, generateMetadata } = verifyEmailPage(careersAuthPages)

export default page
export { generateMetadata }
