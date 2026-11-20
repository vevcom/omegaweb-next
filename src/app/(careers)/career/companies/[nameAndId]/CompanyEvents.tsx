import CompanyEarlierEvents from './CompanyEarlierEvents'
import { earlierEventsPageSize } from './readCompanyEvents'
import EventCard from '@/components/Event/EventCard'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { eventHomePages } from '@/pageKits/events/homePages'
import { eventKinds } from '@/services/events/kinds'
import type { readCompanyEvents } from './readCompanyEvents'

type PropTypes = {
    eventsOfKinds: Awaited<ReturnType<typeof readCompanyEvents>>,
}

/** A section per kind, each event linked to on the home pages of its kind. */
export default function CompanyEvents({ eventsOfKinds }: PropTypes) {
    return eventsOfKinds.map(({ kind, coming, earlier, earlierDetails }) => (
        <section key={kind} className="
            flex flex-col gap-4 p-8 bg-base-200 border border-careers-line
            max-mobile:p-6
        ">
            <h2 className="text-l text-careers-navy">{eventKinds[kind].name}</h2>
            {coming.length > 0 && <>
                <h3 className="text-m">Kommende</h3>
                <div className="row-list">
                    {coming.map(event => <EventCard key={event.id} event={event} config={eventHomePages[kind]} />)}
                </div>
            </>}
            {earlier.length > 0 && <>
                <h3 className="text-m">Tidligere</h3>
                <EventArchivePagingProvider
                    serverRenderedData={earlier}
                    startPage={{ page: 0, pageSize: earlierEventsPageSize }}
                    details={earlierDetails}
                >
                    <CompanyEarlierEvents config={eventHomePages[kind]} />
                </EventArchivePagingProvider>
            </>}
        </section>
    ))
}
