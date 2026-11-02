import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { registerPage } from '@/pageKits/auth/RegisterPage'

const { page, generateMetadata } = registerPage(careersAuthPages)

export default page
export { generateMetadata }
