import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserList from '@/components/User/UserList/UserList'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { authorizeAdminPage } from '@/app/(omegaweb)/admin/authorizeAdminPage'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ session }: PageOperationArgs) => authorizeAdminPage('users/archived', session),
    metadata: () => ({ title: 'Arkiverte brukere' }),
    render: () => (
        <PageWrapper fillHeight>
            <UserPagingProvider
                serverRenderedData={[]}
                startPage={{
                    pageSize: 50,
                    page: 0,
                }}
                details={{
                    groups: [],
                    partOfName: '',
                    partition: 'archived',
                }}
            >
                <UserList />
            </UserPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
