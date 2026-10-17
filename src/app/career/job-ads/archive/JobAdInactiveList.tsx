'use client'
import styles from './JobAdInactiveList.module.scss'
import JobAd from '@/career/job-ads/JobAd'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { JobAdInactivePagingContext } from '@/contexts/paging/JobAdInactivePaging'

export default function JobAdInactiveList() {
    return (
        <main className={styles.JobAdInactiveList}>
            <EndlessScroll
                loadingInfoClassName={styles.loadingInfo}
                pagingContext={JobAdInactivePagingContext}
                renderer={jobAd => (
                    <JobAd jobAd={jobAd} />
                )} />
        </main>
    )
}
