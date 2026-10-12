import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => authorizeAdminPage('courses', session),
    metadata: () => ({ title: 'Emnekatalog' }),
    render: () => (
        <PageWrapper>
            <h1>Emnene</h1>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
