'use client'
import EventCard from '@/components/Event/EventCard'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { EventArchivePagingContext } from '@/contexts/paging/EventArchivePaging'

export default function EventArchiveList() {
    return (
        <main className="row-list">
            <EndlessScroll
                loadingInfoClassName="text-text-muted"
                pagingContext={EventArchivePagingContext}
                renderer={event =>
                    <EventCard key={event.id} event={event} />
                } />
        </main>
    )
}
