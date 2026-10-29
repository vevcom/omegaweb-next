import { eventListHref } from './eventPages'
import CreateOrUpdateEventForm from '@/components/Event/CreateOrUpdateEventForm'
import TagHeaderItem from '@/components/Event/TagHeaderItem'
import EventCard from '@/components/Event/EventCard'
import EventTag from '@/components/Event/EventTag'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { eventOperations } from '@/services/events/operations'
import { eventTagOperations } from '@/services/events/tags/operations'
import { eventTagAuth } from '@/services/events/tags/auth'
import { eventAuth } from '@/services/events/auth'
import { committeeOperations } from '@/services/groups/committees/operations'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage, withFallback } from '@/app/ServerPage'
import Link from 'next/link'
import type { EventPagesConfig } from './eventPages'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The list of coming events, rendered under `config.basePath` on Omega's site and on the career site. */
export const eventsPage = (config: EventPagesConfig) => serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const lockedTag = config.lockedTag
            ? await eventTagOperations.readSpecial({ params: { special: config.lockedTag } })
            : null
        // The tags the visitor picked, which there are none of under a locked tag.
        const pickedTagNames = lockedTag ? null : QueryParams.eventTags.decode(searchParams)

        const [currentEvents, eventTags, committees] = await Promise.all([
            eventOperations.readManyCurrent({ params: { tags: lockedTag ? [lockedTag.name] : pickedTagNames } }),
            eventTagOperations.readAll({}),
            // Only used to populate the "hosting committee" picker of the form creating events; a
            // session without COMMITTEE_USE gets no picker rather than losing the whole page.
            withFallback(committeeOperations.readAll({}), null),
        ])

        return { pickedTagNames, currentEvents, eventTags, committees }
    },
    capabilities: () => ({
        canUpdateTags: eventTagAuth.update,
        canCreateTags: eventTagAuth.create,
        canDestroyTags: eventTagAuth.destroy,
        canCreate: eventAuth.create,
    }),
    metadata: () => ({ title: config.titles.current }),
    render: ({ data, capabilities }) => {
        const { pickedTagNames, currentEvents, eventTags, committees } = data
        const pickedTags = eventTags.filter(tag => pickedTagNames?.includes(tag.name))

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
                                <Link key={tag.name} href={eventListHref(config.basePath, remainingTagNames)}>
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
                                basePath={config.basePath}
                            />
                        )}
                        {capabilities.canCreate.authorized && (
                            <AddHeaderItemPopUp popUpKey="CreateEventPopUp">
                                <div className="min-w-[50vw] grid place-content-center">
                                    <CreateOrUpdateEventForm
                                        basePath={config.basePath}
                                        lockedTag={config.lockedTag}
                                        eventTags={eventTags}
                                        committees={committees}
                                    />
                                </div>
                            </AddHeaderItemPopUp>
                        )}
                        <ArchiveLink href={eventListHref(`${config.basePath}/archive`, pickedTagNames)} />
                    </div>
                </div>
            }>
                {currentEvents.length ? (
                    <div className="row-list">
                        {currentEvents.map(event => (
                            <EventCard event={event} basePath={config.basePath} key={event.id} />
                        ))}
                    </div>
                ) : (
                    <i>Det er for tiden ingen kommende arrangementer</i>
                )}
            </PageWrapper>
        )
    },
})
