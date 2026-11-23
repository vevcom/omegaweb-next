import { SendResetPasswordEmailForm } from '@/app/(careers)/career/(company-auth)/companyUserAccountFlowComponents'
import { serverPage } from '@/app/ServerPage'

/** Where a company user who has forgotten their password asks for a link to choose a new one. */
const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    metadata: () => ({ title: 'Glemt passord' }),
    render: () => <SendResetPasswordEmailForm />,
})

export default page
export { generateMetadata }
