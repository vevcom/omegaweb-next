import { expandedImageIncluder } from '@/services/images/subservice/constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export const highlightableEvent = {
    published: true,
    eventTagEvents: { some: { tag: { special: 'COMPANY_PRESENTATION' } } },
} as const satisfies Prisma.EventWhereInput

export const highlightableJobAd = {
    active: true,
} as const satisfies Prisma.JobAdWhereInput

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
            coverImage: imageSelection,
        },
    },
    jobAd: {
        select: {
            id: true,
            articleName: true,
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
