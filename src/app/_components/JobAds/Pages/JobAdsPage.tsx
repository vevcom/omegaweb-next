import CreateJobAdForm from '@/components/JobAds/CreateJobAdForm'
import CurrentJobAds from '@/components/JobAds/CurrentJobAds'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { CompanyPagingProvider } from '@/contexts/paging/CompanyPaging'
import CompanySelectionProvider from '@/contexts/CompanySelection'
import { jobAdAuth } from '@/services/careers/jobAds/auth'
import { serverPage } from '@/app/ServerPage'
import { sitePagesPath } from '@/lib/sites'
import type { JobAdPagesConfig } from './jobAdPages'

/** The job ads list, rendered under the config's path on both Omega's site and the career site. */
export const jobAdsPage = (config: JobAdPagesConfig) => serverPage({
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
                    <ArchiveLink href={`${sitePagesPath(config)}/archive`} />
                </div>
            }>
            <div className="row-list">
                <CurrentJobAds basePath={sitePagesPath(config)} />
            </div>
        </PageWrapper>
    ),
})
