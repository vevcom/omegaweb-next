import LinkFeideAccountForm from './LinkFeideAccountForm'
import CreateUserForm from '@/components/User/CreateUserForm'
import { userAuth } from '@/services/users/auth'
import { authAuth } from '@/services/auth/auth'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => authorizeAdminPage('users', session),
    capabilities: () => ({
        canCreateUser: userAuth.create,
        canLinkFeideAccount: authAuth.adminLinkFeideAccount,
    }),
    render: ({ capabilities }) => (
        <div className="
            w-full
            [&>*]:w-1/2
        ">
            {capabilities.canCreateUser.authorized && <CreateUserForm />}
            {capabilities.canLinkFeideAccount.authorized && <LinkFeideAccountForm />}
        </div>
    ),
})

export default page
export { generateMetadata }
