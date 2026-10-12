import styles from './page.module.scss'
import CreateJobAdForm from './CreateJobAdForm'
import CurrentJobAds from './CurrentJobAds'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import CompanySelectionProvider from '@/contexts/CompanySelection'

export default async function JobAds() {
    return (
        <PageWrapper
            headerItem={
                <div className={styles.head}>
                    <AddHeaderItemPopUp popUpKey={'jobAdForm'}>
                        <CompanyPagingProvider
                            serverRenderedData={[]}
                            startPage={{
                                page: 0,
                                pageSize: 10
                            }}
                            details={{ name: undefined }}
                        >
                            <CompanySelectionProvider company={null}>
                                <CreateJobAdForm/>
                            </CompanySelectionProvider>
                        </CompanyPagingProvider>
                    </AddHeaderItemPopUp>
                    <ArchiveLink href="/career/jobads/archive" />
                </div>
            }>
            <PageTitleSetter title="Jobbannonser" />
            <div className={styles.wrapper}>
                <CurrentJobAds/>
            </div>
        </PageWrapper>
    )
}
