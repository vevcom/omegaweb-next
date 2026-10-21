'use client'
import JobAd from '@/career/job-ads/JobAd'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { JobAdInactivePagingContext } from '@/contexts/paging/JobAdInactivePaging'

export default function JobAdInactiveList() {
    return (
        <main className="row-list">
            <EndlessScroll
                loadingInfoClassName="text-text-muted"
                pagingContext={JobAdInactivePagingContext}
                renderer={jobAd => (
                    <JobAd jobAd={jobAd} />
                )} />
        </main>
    )
}
