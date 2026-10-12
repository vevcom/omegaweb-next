import styles from './page.module.scss'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserList from '@/components/User/UserList/UserList'
import CreateUserForm from '@/components/User/CreateUserForm'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import PageTitleSetter from '@/contexts/PageTitleSetter'

export default async function Users() {
    return (
        <PageWrapper fillHeight headerItem={
            <AddHeaderItemPopUp popUpKey="createUser">
                <CreateUserForm className={styles.makeUser} />
            </AddHeaderItemPopUp>
        }>
            <PageTitleSetter title={'Brukere'}/>
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

    )
}
