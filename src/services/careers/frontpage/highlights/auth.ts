import { Require } from '@/auth/authorizer/Require'
import { eventsSeenBy } from '@/services/events/auth'
import type { Prisma } from '@/prisma-generated-pn-types'

export const careerFrontpageHighlightAuth = {
    create: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    // Everyone reads the highlights, but only of what the event and job ad pages would let them open.
    readCurrent: Require.filter(({ session }): Prisma.CareerFrontpageHighlightWhereInput => ({
        OR: [
            { event: eventsSeenBy(session) },
            ...(session.permissions.includes('JOBAD_USE') ? [{ jobAdId: { not: null } }] : []),
        ],
    })),
    readMany: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    readTargets: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    update: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    destroy: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
} as const
