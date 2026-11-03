import { careersAuthPages } from '@/app/(careers)/career/(auth)/config'
import { registerPage } from '@/pageKits/auth/pages/RegisterPage'

const { page, generateMetadata } = registerPage(careersAuthPages)

export default page
export { generateMetadata }
