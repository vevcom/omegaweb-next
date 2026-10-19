'use client'
import styles from './EventArchiveList.module.scss'
import EventCard from '@/components/Event/EventCard'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { EventArchivePagingContext } from '@/contexts/paging/EventArchivePaging'

type PropTypes = {
    /** Where the pages of the events live (see EventCard). */
    eventBasePath?: string
}

export default function EventArchiveList({ eventBasePath }: PropTypes) {
    return (
        <main className={styles.EventArchiveList}>
            <EndlessScroll
                loadingInfoClassName={styles.loadingInfo}
                pagingContext={EventArchivePagingContext}
                renderer={event =>
                    <EventCard key={event.id} event={event} basePath={eventBasePath} />
                } />
        </main>
    )
}
