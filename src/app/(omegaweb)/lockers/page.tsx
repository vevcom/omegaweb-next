import styles from './page.module.scss'
import LockerIdForm from './LockerIdForm'
import LockerList from './LockerList'
import LockerScanner from './LockerScanner'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { LockerPagingProvider } from '@/contexts/paging/LockerPaging'
import { lockerAuth } from '@/services/lockers/auth'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    // The list is fetched by the client, so the page checks the rule of that read itself.
    operation: async ({ session }: PageOperationArgs) => {
        lockerAuth.readPage.auth(session).requireAuthorized()
    },
    metadata: () => ({ title: 'Skap' }),
    render: () => (
        <PageWrapper headerItem={
            <div className={styles.header}>
                <LockerIdForm />
                <LockerScanner />
            </div>
        }>
            <LockerPagingProvider
                startPage={{
                    pageSize: 20,
                    page: 0
                }}
                details={undefined}
                serverRenderedData={[]}
            >
                <LockerList />
            </LockerPagingProvider>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
