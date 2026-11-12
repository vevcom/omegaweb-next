import { eventLinks } from '@/pageKits/events/links'
import CreateEventForm from '@/components/Event/CreateEventForm'
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
import SiteLink from '@/components/SiteLink/SiteLink'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The list of coming events, rendered under the config's path on Omega's site and on the career site. */
export function eventsPage(config: EventPagesConfig) {
    const links = eventLinks(config)
    return serverPage({
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const lockedTag = config.lockedTag
                ? await eventTagOperations.readSpecial({ params: { special: config.lockedTag } })
                : null
            // The tags the visitor picked, which there are none of under a locked tag.
            const pickedTagNames = lockedTag ? null : QueryParams.eventTags.decode(searchParams)
            const search = QueryParams.search.decode(searchParams) ?? ''

            const [currentEvents, eventTags, committees] = await Promise.all([
                eventOperations.readManyCurrent({
                    params: { tags: lockedTag ? [lockedTag.name] : pickedTagNames, name: search || undefined }
                }),
                eventTagOperations.readAll({}),
                // Only used to populate the "hosting committee" picker of the form creating events; a
                // session without COMMITTEE_USE gets no picker rather than losing the whole page.
                withFallback(committeeOperations.readAll({}), null),
            ])

            // The creator's own committee is offered as the host of a new event.
            const defaultHostCommitteeId = committees?.find(committee => session.memberships.some(membership => (
                membership.active && membership.groupId === committee.groupId
            )))?.id ?? null

            return { pickedTagNames, search, currentEvents, eventTags, committees, defaultHostCommitteeId }
        },
        capabilities: () => ({
            canUpdateTags: eventTagAuth.update,
            canCreateTags: eventTagAuth.create,
            canDestroyTags: eventTagAuth.destroy,
            canCreate: eventAuth.create,
        }),
        metadata: () => ({ title: config.titles.current }),
        render: ({ data, capabilities }) => {
            const { pickedTagNames, search, currentEvents, eventTags, committees, defaultHostCommitteeId } = data
            const pickedTags = eventTags.filter(tag => pickedTagNames?.includes(tag.name))
            const noEvents = search ? (
                <div className="flex flex-col items-center gap-3 mt-12 text-base-content/80">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="text-4xl" />
                    <i>Ingen kommende arrangementer matcher søket</i>
                </div>
            ) : (
                <i>Det er for tiden ingen kommende arrangementer</i>
            )

            return (
                <PageWrapper search={{ value: search, label: 'Søk etter arrangement' }} headerItem={
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
                                    <SiteLink key={tag.name} href={links.list(remainingTagNames, search)}>
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
                                    search={search}
                                />
                            )}
                            {capabilities.canCreate.authorized && (
                                <AddHeaderItemPopUp popUpKey="CreateEventPopUp">
                                    <div className="min-w-[50vw] grid place-content-center">
                                        <CreateEventForm
                                            config={config}
                                            eventTags={eventTags}
                                            committees={committees}
                                            defaultHostCommitteeId={defaultHostCommitteeId}
                                        />
                                    </div>
                                </AddHeaderItemPopUp>
                            )}
                            <ArchiveLink href={links.archive(pickedTagNames, search)} />
                        </div>
                    </div>
                }>
                    {currentEvents.length ? (
                        <div className="row-list">
                            {currentEvents.map(event => (
                                <EventCard event={event} config={config} key={event.id} />
                            ))}
                        </div>
                    ) : noEvents}
                </PageWrapper>
            )
        },
    })
}
