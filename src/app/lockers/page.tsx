import LockerIdForm from './LockerIdForm'
import LockerList from './LockerList'
import QRButton from './QRButton'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { LockerPagingProvider } from '@/contexts/paging/LockerPaging'
import { lockerAuth } from '@/services/lockers/auth'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    // The list is fetched by the client, so the page checks the rule of that read itself.
    operation: async ({ session }: PageOperationArgs) => {
        lockerAuth.readPage.auth(session).requireAuthorized()
    },
    metadata: () => ({ title: 'Skap' }),
    render: () => (
        <PageWrapper>
            <LockerIdForm />
            <br/>
            <QRButton />

            <h2>Skapliste</h2>
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
