import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

const companyPresentationTag = {
    tag: { special: 'COMPANY_PRESENTATION' },
} as const satisfies Prisma.EventTagEventWhereInput

/** What may be highlighted at all. The front page further requires the event not to have ended. */
export const highlightableEvent = {
    published: true,
    eventTagEvents: { some: companyPresentationTag },
} as const satisfies Prisma.EventWhereInput

export const highlightableJobAd = {
    active: true,
} as const satisfies Prisma.JobAdWhereInput

/** The events a highlight shows on the front page for. `isHighlightShowable` is the same rule on a read highlight. */
export const currentlyHighlightableEvent = (now: Date) => ({
    ...highlightableEvent,
    eventEnd: { gte: now },
}) as const satisfies Prisma.EventWhereInput

/**
 * Whether the front page shows this highlight's target now, as `readCurrent` filters on
 * `currentlyHighlightableEvent` and `highlightableJobAd`. The highlight's own period is not considered.
 */
export function isHighlightShowable({ event, jobAd }: {
    event: { published: boolean, eventEnd: Date, eventTagEvents: unknown[] } | null,
    jobAd: { active: boolean } | null,
}, now: Date): boolean {
    if (event) return event.published && event.eventTagEvents.length > 0 && event.eventEnd >= now
    return jobAd?.active ?? false
}

const imageSelection = {
    select: {
        image: { include: expandedImageIncluder },
    },
} as const satisfies Prisma.CmsImageDefaultArgs

export const careerFrontpageHighlightSelection = {
    id: true,
    start: true,
    end: true,
    event: {
        select: {
            id: true,
            name: true,
            eventStart: true,
            eventEnd: true,
            published: true,
            eventTagEvents: { where: companyPresentationTag, select: { tagId: true } },
            coverImage: imageSelection,
        },
    },
    jobAd: {
        select: {
            id: true,
            articleName: true,
            active: true,
            company: {
                select: {
                    name: true,
                    logo: imageSelection,
                },
            },
        },
    },
} as const satisfies Prisma.CareerFrontpageHighlightSelect

// Relations order nulls last, so the job ads follow the events.
export const currentHighlightOrdering = [
    { event: { eventStart: 'asc' } },
    { start: 'asc' },
    { id: 'asc' },
] as const satisfies Prisma.CareerFrontpageHighlightOrderByWithRelationInput[]

export const adminHighlightOrdering = [
    { end: 'desc' },
    { id: 'desc' },
] as const satisfies Prisma.CareerFrontpageHighlightOrderByWithRelationInput[]

export const highlightableEventSelection = {
    id: true,
    name: true,
    eventStart: true,
} as const satisfies Prisma.EventSelect

export const highlightableJobAdSelection = {
    id: true,
    articleName: true,
    company: { select: { name: true } },
} as const satisfies Prisma.JobAdSelect
