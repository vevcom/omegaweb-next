import { eventListHref } from './eventPages'
import EventArchiveList from '@/components/Event/EventArchiveList'
import TagHeaderItem from '@/components/Event/TagHeaderItem'
import EventTag from '@/components/Event/EventTag'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { eventTagOperations } from '@/services/events/tags/operations'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { eventTagAuth } from '@/services/events/tags/auth'
import { serverPage } from '@/app/ServerPage'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { EventPagesConfig } from './eventPages'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The archive of past events, rendered under `${config.basePath}/archive` on Omega's site and on the career site. */
export const eventsArchivePage = (config: EventPagesConfig) => serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const lockedTag = config.lockedTag
            ? await eventTagOperations.readSpecial({ params: { special: config.lockedTag } })
            : null
        // The tags the visitor picked, which there are none of under a locked tag.
        const pickedTagNames = lockedTag ? null : QueryParams.eventTags.decode(searchParams)
        const eventTags = await eventTagOperations.readAll({})

        return { pickedTagNames, tagNames: lockedTag ? [lockedTag.name] : pickedTagNames, eventTags }
    },
    capabilities: () => ({
        canUpdateTags: eventTagAuth.update,
        canCreateTags: eventTagAuth.create,
        canDestroyTags: eventTagAuth.destroy,
    }),
    metadata: () => ({ title: config.titles.archive }),
    render: ({ data, capabilities }) => {
        const { pickedTagNames, tagNames, eventTags } = data
        const pickedTags = eventTags.filter(tag => pickedTagNames?.includes(tag.name))
        const archivePath = `${config.basePath}/archive`

        return (
            <PageWrapper headerItem={
                <div className="flex justify-between items-center w-full gap-[1em]">
                    <div className="
                        flex items-center gap-[1em]
                        [&_a]:no-underline [&_a]:relative
                        [&_a:hover]:after:content-['✖'] [&_a:hover]:after:text-[4em] [&_a:hover]:after:text-text
                        [&_a:hover]:after:absolute [&_a:hover]:after:left-1/2 [&_a:hover]:after:top-1/2
                        [&_a:hover]:after:-translate-1/2
                    ">
                        {pickedTags.map(tag => {
                            const remainingTagNames = pickedTags
                                .filter(pickedTag => pickedTag.name !== tag.name)
                                .map(pickedTag => pickedTag.name)

                            return (
                                <Link key={tag.name} href={eventListHref(archivePath, remainingTagNames)}>
                                    <EventTag eventTag={tag} />
                                </Link>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-[1em]">
                        {!config.lockedTag && (
                            <TagHeaderItem
                                eventTags={eventTags}
                                currentTags={pickedTags}
                                capabilities={capabilities}
                                basePath={archivePath}
                            />
                        )}
                        <Link
                            href={eventListHref(config.basePath, pickedTagNames)}
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
                }} details={{ tags: tagNames }}>
                    <EventArchiveList basePath={config.basePath} />
                </EventArchivePagingProvider>
            </PageWrapper>
        )
    },
})
