import '@pn-server-only'
import { withFallback } from '@/app/serverPage'
import { eventOperations } from '@/services/events/operations'
import { jobAdOperations } from '@/services/career/jobAds/operations'
import type { ExpandedScreenPage } from '@/services/screens/pages/types'

const maxUpcomingEvents = 5

/**
 * Reads what a page links to through the services that own it, as the one viewing the page, so
 * their access rules apply: a job ad or event the viewer may not see is left out, not shown on the
 * screen. Must run inside a page's operation, which gives the service context.
 */
export async function readScreenPageLinkedContent(page: ExpandedScreenPage) {
    const [jobAd, event, upcomingEvents] = await Promise.all([
        page.type === 'JOBAD' && page.jobAdId !== null
            ? withFallback(jobAdOperations.read({ params: { id: page.jobAdId } }), null)
            : null,
        page.type === 'EVENT' && page.eventId !== null
            ? withFallback(eventOperations.read({ params: { id: page.eventId } }), null)
            : null,
        page.type === 'EVENT_TAG' && page.eventTag !== null
            ? withFallback(eventOperations.readManyCurrent({ params: { tags: [page.eventTag.name] } }), [])
            : [],
    ])
    return { jobAd, event, upcomingEvents: upcomingEvents.slice(0, maxUpcomingEvents) }
}

export type ScreenPageLinkedContent = Awaited<ReturnType<typeof readScreenPageLinkedContent>>
