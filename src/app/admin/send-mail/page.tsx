import MailForm from './mailForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    // The page reads nothing - the operation only gates it.
    operation: async ({ session }: PageOperationArgs) => {
        authorizeAdminPage('send-mail', session)
        return null
    },
    metadata: () => ({ title: 'Elektronisk postutsendelse' }),
    render: () => (
        <PageWrapper>
            <MailForm />
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
