import JobAdInactiveList from '@/components/JobAds/JobAdInactiveList'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { JobAdInactivePagingProvider } from '@/contexts/paging/JobAdInactivePaging'
import { serverPage } from '@/app/ServerPage'
import { sitePagesPath } from '@/lib/sites'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { JobAdPagesConfig } from './jobAdPages'

/** The archive of inactive job ads, rendered under `${path}/archive` on both Omega's site and the career site. */
export const jobAdsArchivePage = (config: JobAdPagesConfig) => serverPage({
    operation: () => ({}),
    metadata: () => ({ title: 'Arkiverte jobbannonser' }),
    render: () => (
        <PageWrapper headerItem={
            <Link href={sitePagesPath(config)} className="
                text-text
                [&_svg]:size-[30px]!
            ">
                <FontAwesomeIcon icon={faArrowLeft} />
            </Link>
        }>
            <JobAdInactivePagingProvider
                startPage={{
                    page: 0,
                    pageSize: 12,
                }}
                details={{
                    name: null,
                    type: null,
                }}
                serverRenderedData={[]}
            >
                <JobAdInactiveList basePath={sitePagesPath(config)} />
            </JobAdInactivePagingProvider>
        </PageWrapper>
    ),
})
