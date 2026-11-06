'use client'
import EventCard from '@/components/Event/EventCard'
import EndlessScroll from '@/components/PagingWrappers/EndlessScroll'
import { EventArchivePagingContext } from '@/contexts/paging/EventArchivePaging'
import type { EventPagesConfig } from '@/pageKits/events/config'

type PropTypes = {
    config: EventPagesConfig
}

export default function EventArchiveList({ config }: PropTypes) {
    return (
        <main className="row-list">
            <EndlessScroll
                loadingInfoClassName="text-base-content/80"
                pagingContext={EventArchivePagingContext}
                renderer={event =>
                    <EventCard key={event.id} event={event} config={config} />
                } />
        </main>
    )
}
