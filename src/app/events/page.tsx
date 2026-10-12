import styles from './page.module.scss'
import CreateOrUpdateEventForm from './CreateOrUpdateEventForm'
import TagHeaderItem from './TagHeaderItem'
import { AddHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import ArchiveLink from '@/components/HeaderItems/ArchiveLink'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import EventTag from '@/components/Event/EventTag'
import { eventOperations } from '@/services/events/operations'
import EventCard from '@/components/Event/EventCard'
import { eventTagOperations } from '@/services/events/tags/operations'
import { eventTagAuth } from '@/services/events/tags/auth'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const tagNames = QueryParams.eventTags.decode(searchParams)

        const [currentEvents, eventTags] = await Promise.all([
            eventOperations.readManyCurrent({ params: { tags: tagNames } }),
            eventTagOperations.readAll({}),
        ])

        return { tagNames, currentEvents, eventTags }
    },
    capabilities: () => ({
        canUpdateTags: eventTagAuth.update,
        canCreateTags: eventTagAuth.create,
        canDestroyTags: eventTagAuth.destroy,
    }),
    metadata: () => ({ title: 'Hvad der hender' }),
    render: ({ data, capabilities }) => {
        const { tagNames, currentEvents, eventTags } = data
        const currentTags = tagNames ? eventTags.filter(tag => tagNames.includes(tag.name)) : []

        return (
            <PageWrapper headerItem={
                <div className={styles.header}>
                    <div className={styles.tags}>
                        {currentTags.map(tag => {
                            const remainingTags = currentTags
                                .filter(currentTag => currentTag.name !== tag.name)
                                .map(currentTag => currentTag.name)
                            const href = currentTags.length === 1 ?
                                '/events' :
                                `/events?${QueryParams.eventTags.encodeUrl(remainingTags)}`

                            return (
                                <Link key={tag.name} href={href}>
                                    <EventTag eventTag={tag} />
                                </Link>
                            )
                        })}
                    </div>
                    <div className={styles.actions}>
                        <TagHeaderItem
                            eventTags={eventTags}
                            currentTags={currentTags}
                            capabilities={capabilities}
                            page="EVENT"
                        />
                        <AddHeaderItemPopUp popUpKey="CreateEventPopUp">
                            <div className={styles.createEvent}>
                                <CreateOrUpdateEventForm eventTags={eventTags} />
                            </div>
                        </AddHeaderItemPopUp>
                        <ArchiveLink href={tagNames?.length ?
                            `/events/archive?${QueryParams.eventTags.encodeUrl(tagNames)}`
                            :
                            '/events/archive'
                        } />
                    </div>
                </div>
            }>
                <div className={styles.wrapper}>
                    {
                        currentEvents.map(event =>
                            <EventCard event={event} key={event.id} />
                        )
                    }
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
