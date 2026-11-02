import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { loginPage } from '@/pageKits/auth/pages/LoginPage'

const { page, generateMetadata } = loginPage(careersAuthPages)

export default page
export { generateMetadata }
