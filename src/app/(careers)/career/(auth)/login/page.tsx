import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { loginPage } from '@/pageKits/auth/pages/LoginPage'

const { page, generateMetadata } = loginPage(careersAuthPages)

export default page
export { generateMetadata }
