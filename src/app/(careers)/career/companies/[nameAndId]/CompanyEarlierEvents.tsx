'use client'
import EventCard from '@/components/Event/EventCard'
import Button from '@/components/UI/Button'
import { EventArchivePagingContext } from '@/contexts/paging/EventArchivePaging'
import { useContext } from 'react'
import type { EventPagesConfig } from '@/pageKits/events/config'

type PropTypes = {
    /** The home pages of the kind, which the cards link into. */
    config: EventPagesConfig,
}

/**
 * The earlier events of one kind, read a page at a time on a button and never by scrolling, since
 * the sections of the other kinds follow below. A first page that is not full is all there is.
 */
export default function CompanyEarlierEvents({ config }: PropTypes) {
    const paging = useContext(EventArchivePagingContext)
    if (!paging) throw new Error('EventArchivePagingContext er ikke definert')
    const { state, loading, loadMore, serverRenderedData, startPage } = paging
    const mayHaveMore = !state.allLoaded && serverRenderedData.length === startPage.pageSize

    return <>
        <div className="row-list">
            {state.data.map(event => <EventCard key={event.id} event={event} config={config} />)}
        </div>
        {mayHaveMore && (
            <Button type="button" className="self-start" disabled={loading} onClick={() => void loadMore()}>
                Last inn flere
            </Button>
        )}
    </>
}
