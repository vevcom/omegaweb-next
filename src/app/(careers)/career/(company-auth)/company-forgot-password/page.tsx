import SendResetPasswordEmailForm from '@/pageKits/auth/components/SendResetPasswordEmailForm'
import { sendCompanyUserResetPasswordEmailAction } from '@/services/careers/companies/users/account/actions'
import { configureAction } from '@/services/configureAction'
import { serverPage } from '@/app/ServerPage'

/** Where a company user who has forgotten their password asks for a link to choose a new one. */
const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    metadata: () => ({ title: 'Glemt passord' }),
    render: () => (
        <SendResetPasswordEmailForm
            action={configureAction(sendCompanyUserResetPasswordEmailAction, { params: { site: 'CAREERS' } })}
        />
    ),
})

export default page
export { generateMetadata }
