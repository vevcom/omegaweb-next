import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserList from '@/components/User/UserList/UserList'
import CreateUserForm from '@/components/User/CreateUserForm'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { userAuth } from '@/services/users/auth'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    capabilities: () => ({
        canCreate: userAuth.create,
    }),
    metadata: () => ({ title: 'Brukere' }),
    render: ({ capabilities }) => (
        <PageWrapper fillHeight headerItem={
            capabilities.canCreate.authorized && (
                <AddHeaderItemPopUp popUpKey="createUser">
                    <CreateUserForm className="min-w-[30vw] flex flex-col items-center justify-center" />
                </AddHeaderItemPopUp>
            )
        }>
            <div className="h-full">
                <UserPagingProvider
                    serverRenderedData={[]}
                    startPage={{
                        pageSize: 50,
                        page: 0,
                    }}
                    details={{
                        groups: [],
                        partOfName: ''
                    }}
                >
                    <UserList linksToUser={true} />
                </UserPagingProvider>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
