import { eventLinks } from '@/pageKits/events/links'
import EventArchiveList from '@/components/Event/EventArchiveList'
import TagHeaderItem from '@/components/Event/TagHeaderItem'
import EventTag from '@/components/Event/EventTag'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { eventTagOperations } from '@/services/events/tags/operations'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { QueryParams } from '@/lib/queryParams/queryParams'
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
            const lockedTag = config.lockedTag
                ? await eventTagOperations.readSpecial({ params: { special: config.lockedTag } })
                : null
            // The tags the visitor picked, which there are none of under a locked tag.
            const pickedTagNames = lockedTag ? null : QueryParams.eventTags.decode(searchParams)
            const search = QueryParams.search.decode(searchParams) ?? ''
            const eventTags = await eventTagOperations.readAll({})

            return { pickedTagNames, search, tagNames: lockedTag ? [lockedTag.name] : pickedTagNames, eventTags }
        },
        capabilities: () => ({
            canUpdateTags: eventTagAuth.update,
            canCreateTags: eventTagAuth.create,
            canDestroyTags: eventTagAuth.destroy,
        }),
        metadata: () => ({ title: config.titles.archive }),
        render: ({ data, capabilities }) => {
            const { pickedTagNames, search, tagNames, eventTags } = data
            const pickedTags = eventTags.filter(tag => pickedTagNames?.includes(tag.name))

            return (
                <PageWrapper search={{ value: search, label: 'Søk i arkivet' }} headerItem={
                    <div className="flex justify-between items-center w-full gap-[1em]">
                        <div className="
                            flex items-center gap-[1em]
                            [&_a]:no-underline [&_a]:relative
                            [&_a:hover]:after:content-['✖'] [&_a:hover]:after:text-[4em]
                            [&_a:hover]:after:text-base-content [&_a:hover]:after:absolute [&_a:hover]:after:left-1/2
                            [&_a:hover]:after:top-1/2 [&_a:hover]:after:-translate-1/2
                        ">
                            {pickedTags.map(tag => {
                                const remainingTagNames = pickedTags
                                    .filter(pickedTag => pickedTag.name !== tag.name)
                                    .map(pickedTag => pickedTag.name)

                                return (
                                    <SiteLink key={tag.name} href={links.archive(remainingTagNames, search)}>
                                        <EventTag eventTag={tag} />
                                    </SiteLink>
                                )
                            })}
                        </div>
                        <div className="flex items-center gap-[1em]">
                            {!config.lockedTag && (
                                <TagHeaderItem
                                    eventTags={eventTags}
                                    currentTags={pickedTags}
                                    capabilities={capabilities}
                                    config={config}
                                    archive
                                    search={search}
                                />
                            )}
                            <SiteLink
                                href={links.list(pickedTagNames, search)}
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
                    }} details={{ tags: tagNames, name: search || undefined }} key={search}>
                        <EventArchiveList config={config} />
                    </EventArchivePagingProvider>
                </PageWrapper>
            )
        },
    })
}
