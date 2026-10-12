import LockerIdForm from './LockerIdForm'
import LockerList from './LockerList'
import QRButton from './QRButton'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { LockerPagingProvider } from '@/contexts/paging/LockerPaging'

export default async function Lockers() {
    return (
        <PageWrapper>
            <PageTitleSetter title="Skap" />
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
    )
}
