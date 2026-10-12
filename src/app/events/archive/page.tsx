import styles from './page.module.scss'
import EventArchiveList from './EventArchiveList'
import TagHeaderItem from '@/app/events/TagHeaderItem'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import EventTag from '@/components/Event/EventTag'
import { eventTagOperations } from '@/services/events/tags/operations'
import { EventArchivePagingProvider } from '@/contexts/paging/EventArchivePaging'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { eventTagAuth } from '@/services/events/tags/auth'
import { serverPage } from '@/app/serverPage'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => {
        const tagNames = QueryParams.eventTags.decode(searchParams)
        const eventTags = await eventTagOperations.readAll({})
        return { tagNames, eventTags }
    },
    capabilities: () => ({
        canUpdateTags: eventTagAuth.update,
        canCreateTags: eventTagAuth.create,
        canDestroyTags: eventTagAuth.destroy,
    }),
    metadata: () => ({ title: 'Hvad der har hendt' }),
    render: ({ data, capabilities }) => {
        const { tagNames, eventTags } = data
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
                                '/events/archive' :
                                `/events/archive?${QueryParams.eventTags.encodeUrl(remainingTags)}`

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
                            page="EVENT_ARCHIVE"
                        />
                        <Link
                            href={tagNames?.length
                                ? `/events?${QueryParams.eventTags.encodeUrl(tagNames)}`
                                : '/events'}
                            className={styles.backLink}
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
                    <EventArchiveList />
                </EventArchivePagingProvider>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
