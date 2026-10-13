import styles from './page.module.scss'
import CreateJobAdForm from './CreateJobAdForm'
import CurrentJobAds from './CurrentJobAds'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import CompanySelectionProvider from '@/contexts/CompanySelection'
import { jobAdAuth } from '@/services/career/jobAds/auth'
import { serverPage } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async () => ({}),
    capabilities: () => ({
        canCreate: jobAdAuth.create,
    }),
    metadata: () => ({ title: 'Jobbannonser' }),
    render: ({ capabilities }) => (
        <PageWrapper
            headerItem={
                <div className={styles.head}>
                    {capabilities.canCreate.authorized && (
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
                    )}
                    <ArchiveLink href="/career/jobads/archive" />
                </div>
            }>
            <div className={styles.wrapper}>
                <CurrentJobAds/>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
