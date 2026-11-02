import { revueAuthPages } from '@/app/(revue)/_lib/revueSite'
import { resetPasswordFormPage } from '@/pageKits/auth/pages/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(revueAuthPages)

export default page
export { generateMetadata }
