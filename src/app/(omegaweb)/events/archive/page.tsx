import EventArchiveList from './EventArchiveList'
import TagHeaderItem from '@/app/(omegaweb)/events/TagHeaderItem'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import EventTag from '@/components/Event/EventTag'
import { eventsHref } from '@/components/Event/eventsHref'
import { eventTagOperations } from '@/services/events/tags/operations'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { eventTagAuth } from '@/services/events/tags/auth'
import { serverPage } from '@/app/ServerPage'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const tagNames = QueryParams.eventTags.decode(searchParams)
        const search = QueryParams.search.decode(searchParams) ?? ''
        const eventTags = await eventTagOperations.readAll({})
        return { tagNames, search, eventTags }
    },
    capabilities: () => ({
        canUpdateTags: eventTagAuth.update,
        canCreateTags: eventTagAuth.create,
        canDestroyTags: eventTagAuth.destroy,
    }),
    metadata: () => ({ title: 'Hvad der har hendt' }),
    render: ({ data, capabilities }) => {
        const { tagNames, search, eventTags } = data
        const currentTags = tagNames ? eventTags.filter(tag => tagNames.includes(tag.name)) : []

        return (
            <PageWrapper search={{ value: search, label: 'Søk i arkivet' }} headerItem={
                <div className="flex justify-between items-center w-full gap-[1em]">
                    <div className="
                        flex items-center gap-[1em]
                        [&_a]:no-underline [&_a]:relative
                        [&_a:hover]:after:content-['✖'] [&_a:hover]:after:text-[4em] [&_a:hover]:after:text-text
                        [&_a:hover]:after:absolute [&_a:hover]:after:left-1/2 [&_a:hover]:after:top-1/2
                        [&_a:hover]:after:-translate-1/2
                    ">
                        {currentTags.map(tag => {
                            const href = eventsHref('EVENT_ARCHIVE', {
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
                            page="EVENT_ARCHIVE"
                            search={search}
                        />
                        <Link
                            href={eventsHref('EVENT', { tags: tagNames, search })}
                            className="
                                text-text
                                [&_svg]:size-[30px]!
                            "
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                        </Link>
                    </div>
                </div>
            }>
                <EventArchivePagingProvider serverRenderedData={[]} startPage={{
                    page: 0,
                    pageSize: 12
                }} details={{ tags: tagNames, name: search || undefined }} key={search}>
                    <EventArchiveList />
                </EventArchivePagingProvider>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
