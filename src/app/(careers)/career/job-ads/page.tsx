import CreateJobAdForm from './CreateJobAdForm'
import CurrentJobAds from './CurrentJobAds'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import CompanySelectionProvider from '@/contexts/CompanySelection'
import { jobAdAuth } from '@/services/career/jobAds/auth'
import { serverPage } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: () => ({}),
    capabilities: () => ({
        canCreate: jobAdAuth.create,
    }),
    metadata: () => ({ title: 'Jobbannonser' }),
    render: ({ capabilities }) => (
        <PageWrapper
            headerItem={
                <div className="flex items-center gap-[1em]">
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
                    <ArchiveLink href="/career/job-ads/archive" />
                </div>
            }>
            <div className="row-list">
                <CurrentJobAds/>
            </div>
        </PageWrapper>
    ),
})

export default page
export { generateMetadata }
