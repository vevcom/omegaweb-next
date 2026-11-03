import { revueAuthPages } from '@/app/(revue)/revue/(auth)/config'
import { resetPasswordFormPage } from '@/pageKits/auth/pages/ResetPasswordFormPage'

const { page, generateMetadata } = resetPasswordFormPage(revueAuthPages)

export default page
export { generateMetadata }
