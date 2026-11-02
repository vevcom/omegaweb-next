import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { loginPage } from '@/pageKits/auth/LoginPage'

const { page, generateMetadata } = loginPage(careersAuthPages)

export default page
export { generateMetadata }
