import JobAdInactiveList from './JobAdInactiveList'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { JobAdInactivePagingProvider } from '@/contexts/paging/JobAdInactivePaging'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'

export default function JobAdsArchive() {
    return (
        <PageWrapper headerItem={
            <Link href="/career/job-ads" className="
                text-text
                [&_svg]:size-[30px]!
            ">
                <FontAwesomeIcon icon={faArrowLeft} />
            </Link>
        }>
            <PageTitleSetter title="Arkiverte jobbannonser" />
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
                <JobAdInactiveList />
            </JobAdInactivePagingProvider>
        </PageWrapper>
    )
}
