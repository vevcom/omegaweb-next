import type {
    careerFrontpageHighlightSelection,
    highlightableEventSelection,
    highlightableJobAdSelection,
} from './constants'
import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedCareerFrontpageHighlight = Prisma.CareerFrontpageHighlightGetPayload<{
    select: typeof careerFrontpageHighlightSelection,
}>

/** What an administrator may choose to highlight. */
export type CareerFrontpageHighlightTargets = {
    events: Prisma.EventGetPayload<{ select: typeof highlightableEventSelection }>[],
    jobAds: Prisma.JobAdGetPayload<{ select: typeof highlightableJobAdSelection }>[],
}
