import { eventLinks } from '@/pageKits/events/links'
import { eventListFilterOf, kindsToRead } from '@/pageKits/events/filter'
import CreateEventForm from '@/components/Event/CreateEventForm'
import TagHeaderItem from '@/components/Event/TagHeaderItem'
import EventCard from '@/components/Event/EventCard'
import PickedEventFilters from '@/components/Event/PickedEventFilters'
import EventKindFilter from '@/components/Event/EventKindFilter'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { eventOperations } from '@/services/events/operations'
import { eventTagOperations } from '@/services/events/tags/operations'
import { eventTagAuth } from '@/services/events/tags/auth'
import { eventAuth } from '@/services/events/auth'
import { committeeOperations } from '@/services/groups/committees/operations'
import { serverPage, withFallback } from '@/app/ServerPage'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/** The list of coming events, rendered under the config's path on Omega's site and on the career site. */
export function eventsPage(config: EventPagesConfig) {
    const links = eventLinks(config)
    return serverPage({
        operation: async ({ searchParams, session }: PageOperationArgs) => {
            const filter = eventListFilterOf(config, searchParams)

            const [currentEvents, eventTags, committees] = await Promise.all([
                eventOperations.readManyCurrent({
                    params: {
                        tags: filter.tagNames,
                        kinds: kindsToRead(config, filter),
                        name: filter.search || undefined,
                    }
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

            return { filter, currentEvents, eventTags, committees, defaultHostCommitteeId }
        },
        capabilities: () => ({
            canUpdateTags: eventTagAuth.update,
            canCreateTags: eventTagAuth.create,
            canDestroyTags: eventTagAuth.destroy,
            canCreate: eventAuth.create.data({ setsCompany: false }),
        }),
        metadata: () => ({ title: config.titles.current }),
        render: ({ data, capabilities }) => {
            const { filter, currentEvents, eventTags, committees, defaultHostCommitteeId } = data
            const noEvents = filter.search ? (
                <div className="flex flex-col items-center gap-3 mt-12 text-base-content/80">
                    <FontAwesomeIcon icon={faMagnifyingGlass} className="text-4xl" />
                    <i>Ingen kommende arrangementer matcher søket</i>
                </div>
            ) : (
                <i>Det er for tiden ingen kommende arrangementer</i>
            )

            return (
                <PageWrapper search={{ value: filter.search, label: 'Søk etter arrangement' }} headerItem={
                    <div className="flex justify-between items-center w-full gap-[1em]">
                        <div className="flex flex-wrap items-center gap-[1em]">
                            <EventKindFilter config={config} filter={filter} />
                            <PickedEventFilters config={config} filter={filter} eventTags={eventTags} />
                        </div>
                        <div className="flex items-center gap-[1em]">
                            {config.tagFilter && (
                                <TagHeaderItem
                                    eventTags={eventTags}
                                    filter={filter}
                                    capabilities={capabilities}
                                    config={config}
                                />
                            )}
                            {capabilities.canCreate.authorized && (
                                <AddHeaderItemPopUp popUpKey="CreateEventPopUp">
                                    <div className="min-w-[50vw] grid place-content-center">
                                        <CreateEventForm
                                            config={config}
                                            committees={committees}
                                            defaultHostCommitteeId={defaultHostCommitteeId}
                                        />
                                    </div>
                                </AddHeaderItemPopUp>
                            )}
                            <ArchiveLink href={links.archive(filter)} />
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
