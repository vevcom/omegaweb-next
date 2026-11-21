import { eventLinks } from '@/pageKits/events/links'
import { eventListFilterOf, kindsToRead } from '@/pageKits/events/filter'
import EventArchiveList from '@/components/Event/EventArchiveList'
import TagHeaderItem from '@/components/Event/TagHeaderItem'
import PickedEventTags from '@/components/Event/PickedEventTags'
import EventKindFilter from '@/components/Event/EventKindFilter'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { eventTagOperations } from '@/services/events/tags/operations'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { eventTagAuth } from '@/services/events/tags/auth'
import { serverPage } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The archive of past events, rendered under `${path}/archive` on Omega's site and on the career site. */
export function eventsArchivePage(config: EventPagesConfig) {
    const links = eventLinks(config)
    return serverPage({
        operation: async ({ searchParams }: PageOperationArgs) => {
            const eventTags = await eventTagOperations.readAll({})

            return { filter: eventListFilterOf(config, searchParams), eventTags }
        },
        capabilities: () => ({
            canUpdateTags: eventTagAuth.update,
            canCreateTags: eventTagAuth.create,
            canDestroyTags: eventTagAuth.destroy,
        }),
        metadata: () => ({ title: config.titles.archive }),
        render: ({ data, capabilities }) => {
            const { filter, eventTags } = data

            return (
                <PageWrapper search={{ value: filter.search, label: 'Søk i arkivet' }} headerItem={
                    <div className="flex justify-between items-center w-full gap-[1em]">
                        <div className="flex flex-wrap items-center gap-[1em]">
                            <EventKindFilter config={config} filter={filter} archive />
                            <PickedEventTags config={config} filter={filter} eventTags={eventTags} archive />
                        </div>
                        <div className="flex items-center gap-[1em]">
                            {config.tagFilter && (
                                <TagHeaderItem
                                    eventTags={eventTags}
                                    filter={filter}
                                    capabilities={capabilities}
                                    config={config}
                                    archive
                                />
                            )}
                            <SiteLink
                                href={links.list(filter)}
                                className="
                                    text-base-content
                                    [&_svg]:size-[30px]!
                                "
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </SiteLink>
                        </div>
                    </div>
                }>
                    <EventArchivePagingProvider serverRenderedData={[]} startPage={{
                        page: 0,
                        pageSize: 12
                    }} details={{
                        tags: filter.tagNames,
                        kinds: kindsToRead(config, filter),
                        name: filter.search || undefined,
                    }} key={JSON.stringify(filter)}>
                        <EventArchiveList config={config} />
                    </EventArchivePagingProvider>
                </PageWrapper>
            )
        },
    })
}
