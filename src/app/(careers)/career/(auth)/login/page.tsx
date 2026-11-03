import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { loginPage } from '@/components/Auth/Pages/LoginPage'

const { page, generateMetadata } = loginPage(careersAuthPages)

export default page
export { generateMetadata }
