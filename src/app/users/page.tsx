import styles from './page.module.scss'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserList from '@/components/User/UserList/UserList'
import CreateUserForm from '@/components/User/CreateUserForm'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { userAuth } from '@/services/users/auth'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => ({}),
    capabilities: () => ({
        canCreate: userAuth.create,
    }),
    metadata: () => ({ title: 'Brukere' }),
    render: ({ capabilities }) => (
        <PageWrapper fillHeight headerItem={
            capabilities.canCreate.authorized && (
                <AddHeaderItemPopUp popUpKey="createUser">
                    <CreateUserForm className={styles.makeUser} />
                </AddHeaderItemPopUp>
            )
        }>
            <div className={styles.wrapper}>
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
