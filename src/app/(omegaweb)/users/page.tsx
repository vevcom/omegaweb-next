import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserList from '@/components/User/UserList/UserList'
import CreateUserForm from '@/components/User/CreateUserForm'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import UserListFiltersProvider from '@/contexts/UserListFilters'
import UserListFiltersToggle from '@/components/User/UserList/UserListFiltersToggle'
import { userAuth } from '@/services/users/auth'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ searchParams }: PageOperationArgs) => ({
        search: QueryParams.search.decode(searchParams) ?? '',
    }),
    capabilities: () => ({
        canCreate: userAuth.create,
    }),
    metadata: () => ({ title: 'Brukere' }),
    render: ({ data, capabilities }) => (
        // The list filters on the client, so the search only updates the URL and UserList follows it.
        <UserListFiltersProvider>
            <PageWrapper fillHeight search={{ value: data.search, label: 'Søk etter navn', shallow: true }} headerItem={
                <div className="
                    flex items-center justify-end w-full gap-2
                    max-mobile:justify-between
                ">
                    <UserListFiltersToggle />
                    {capabilities.canCreate.authorized && (
                        <AddHeaderItemPopUp popUpKey="createUser">
                            <CreateUserForm className="min-w-[30vw] flex flex-col items-center justify-center" />
                        </AddHeaderItemPopUp>
                    )}
                </div>
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
                            partOfName: data.search,
                        }}
                    >
                        <UserList linksToUser={true} nameFromSearchParam />
                    </UserPagingProvider>
                </div>
            </PageWrapper>
        </UserListFiltersProvider>
    ),
})

export default page
export { generateMetadata }
