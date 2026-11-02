import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { registerPage } from '@/pageKits/auth/pages/RegisterPage'

const { page, generateMetadata } = registerPage(careersAuthPages)

export default page
export { generateMetadata }
