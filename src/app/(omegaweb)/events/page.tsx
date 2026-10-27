import CreateOrUpdateEventForm from './CreateOrUpdateEventForm'
import TagHeaderItem from './TagHeaderItem'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import EventTag from '@/components/Event/EventTag'
import { eventOperations } from '@/services/events/operations'
import EventCard from '@/components/Event/EventCard'
import { eventsHref } from '@/components/Event/eventsHref'
import { eventTagOperations } from '@/services/events/tags/operations'
import { eventTagAuth } from '@/services/events/tags/auth'
import { eventAuth } from '@/services/events/auth'
import { committeeOperations } from '@/services/groups/committees/operations'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage, withFallback } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const tagNames = QueryParams.eventTags.decode(searchParams)
        const search = QueryParams.search.decode(searchParams) ?? ''

        const [currentEvents, eventTags, committees] = await Promise.all([
            eventOperations.readManyCurrent({ params: { tags: tagNames, name: search || undefined } }),
            eventTagOperations.readAll({}),
            // Only used to populate the "hosting committee" picker; a session without
            // COMMITTEE_USE gets no picker rather than losing the whole page.
            withFallback(committeeOperations.readAll({}), null),
        ])

        return { tagNames, search, currentEvents, eventTags, committees }
    },
    capabilities: () => ({
        canUpdateTags: eventTagAuth.update,
        canCreateTags: eventTagAuth.create,
        canDestroyTags: eventTagAuth.destroy,
        canCreate: eventAuth.create,
    }),
    metadata: () => ({ title: 'Hvad der hender' }),
    render: ({ data, capabilities }) => {
        const { tagNames, search, currentEvents, eventTags, committees } = data
        const currentTags = tagNames ? eventTags.filter(tag => tagNames.includes(tag.name)) : []

        return (
            <PageWrapper search={{ value: search, label: 'Søk etter arrangement' }} headerItem={
                <div className="flex justify-between items-center w-full gap-[1em]">
                    <div className="
                        flex items-center gap-[1em]
                        [&_a]:no-underline [&_a]:relative
                        [&_a:hover]:after:content-['✖'] [&_a:hover]:after:text-[4em] [&_a:hover]:after:text-text
                        [&_a:hover]:after:absolute [&_a:hover]:after:left-1/2 [&_a:hover]:after:top-1/2
                        [&_a:hover]:after:-translate-1/2
                    ">
                        {currentTags.map(tag => {
                            const href = eventsHref('EVENT', {
                                tags: currentTags
                                    .filter(currentTag => currentTag.name !== tag.name)
                                    .map(currentTag => currentTag.name),
                                search,
                            })

                            return (
                                <Link key={tag.name} href={href}>
                                    <EventTag eventTag={tag} />
                                </Link>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-[1em]">
                        <TagHeaderItem
                            eventTags={eventTags}
                            currentTags={currentTags}
                            capabilities={capabilities}
                            page="EVENT"
                            search={search}
                        />
                        {capabilities.canCreate.authorized && (
                            <AddHeaderItemPopUp popUpKey="CreateEventPopUp">
                                <div className="min-w-[50vw] grid place-content-center">
                                    <CreateOrUpdateEventForm eventTags={eventTags} committees={committees} />
                                </div>
                            </AddHeaderItemPopUp>
                        )}
                        <ArchiveLink href={eventsHref('EVENT_ARCHIVE', { tags: tagNames, search })} />
                    </div>
                </div>
            }>
                {search && currentEvents.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 mt-12 text-text-muted">
                        <FontAwesomeIcon icon={faMagnifyingGlass} className="text-4xl" />
                        <i>Ingen kommende arrangementer matcher søket</i>
                    </div>
                ) : (
                    <div className="row-list">
                        {
                            currentEvents.map(event =>
                                <EventCard event={event} key={event.id} />
                            )
                        }
                    </div>
                )}
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
