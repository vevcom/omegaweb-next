import styles from './page.module.scss'
import LinkFeideAccountForm from './LinkFeideAccountForm'
import CreateUserForm from '@/components/User/CreateUserForm'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('users', session),
    render: () => (
        <div className={styles.wrapper}>
            <CreateUserForm />
            <LinkFeideAccountForm />
        </div>
    ),
})

export default page
export { generateMetadata }
