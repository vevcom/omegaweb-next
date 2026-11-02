import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { resetPasswordFormPage } from '@/pageKits/auth/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(revueAuthPages)

export default page
export { generateMetadata }
