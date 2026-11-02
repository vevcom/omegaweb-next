import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { registerEmailPage } from '@/pageKits/auth/RegisterEmailPage'

const { page, generateMetadata } = registerEmailPage(careersAuthPages)

export default page
export { generateMetadata }
