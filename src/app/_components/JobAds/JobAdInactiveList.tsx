'use client'
import JobAd from './JobAd'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { JobAdInactivePagingContext } from '@/contexts/paging/JobAdInactivePaging'
import type { JobAdPagesConfig } from '@/pageKits/jobAds/config'

type PropTypes = {
    config: JobAdPagesConfig
}

export default function JobAdInactiveList({ config }: PropTypes) {
    return (
        <main className="row-list">
            <EndlessScroll
                loadingInfoClassName="text-text-muted"
                pagingContext={JobAdInactivePagingContext}
                renderer={jobAd => (
                    <JobAd jobAd={jobAd} config={config} />
                )} />
        </main>
    )
}
