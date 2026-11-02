import { jobAdLinks } from './links'
import JobAdInactiveList from '@/components/JobAds/JobAdInactiveList'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { JobAdInactivePagingProvider } from '@/contexts/paging/JobAdInactivePaging'
import { serverPage } from '@/app/ServerPage'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { JobAdPagesConfig } from './config'

/** The archive of inactive job ads, rendered under `${path}/archive` on both Omega's site and the career site. */
export function jobAdsArchivePage(config: JobAdPagesConfig) {
    const links = jobAdLinks(config)
    return serverPage({
        operation: () => ({}),
        metadata: () => ({ title: 'Arkiverte jobbannonser' }),
        render: () => (
            <PageWrapper headerItem={
                <Link href={links.list()} className="
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
                    <JobAdInactiveList config={config} />
                </JobAdInactivePagingProvider>
            </PageWrapper>
        ),
    })
}
