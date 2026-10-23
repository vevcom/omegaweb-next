'use client'
import JobAd from './JobAd'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { JobAdInactivePagingContext } from '@/contexts/paging/JobAdInactivePaging'

type PropTypes = {
    basePath: string
}

export default function JobAdInactiveList({ basePath }: PropTypes) {
    return (
        <main className="row-list">
            <EndlessScroll
                loadingInfoClassName="text-text-muted"
                pagingContext={JobAdInactivePagingContext}
                renderer={jobAd => (
                    <JobAd jobAd={jobAd} basePath={basePath} />
                )} />
        </main>
    )
}
