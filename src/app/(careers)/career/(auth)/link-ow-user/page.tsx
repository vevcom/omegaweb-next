import { careersAuthPages } from '@/app/(careers)/_lib/careersSite'
import { linkOwUserPage } from '@/components/Auth/Pages/LinkOwUserPage'

const { page, generateMetadata } = linkOwUserPage(careersAuthPages)

export default page
export { generateMetadata }
