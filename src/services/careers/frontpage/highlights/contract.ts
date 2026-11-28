import { careerFrontpageHighlightDataFieldSchemas, careerFrontpageHighlightParamsFieldSchemas } from './schemas'
import { Require } from '@/auth/authorizer/Require'
import { eventsSeenBy } from '@/services/events/auth'
import { defineContract } from '@/services/serviceContract'
import type { Prisma } from '@/prisma-generated-pn-types'

const highlight = careerFrontpageHighlightDataFieldSchemas.pick({
    eventId: true,
    jobAdId: true,
    start: true,
    end: true,
})

const id = careerFrontpageHighlightParamsFieldSchemas.pick({
    id: true,
})

export const careerFrontpageHighlightContract = defineContract({
    create: {
        data: highlight,
        authorizer: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    },
    // Everyone reads the highlights, but only of what the event and job ad pages would let them open.
    readCurrent: {
        authorizer: Require.filter(({ session }): Prisma.CareerFrontpageHighlightWhereInput => ({
            OR: [
                { event: eventsSeenBy(session) },
                ...(session.permissions.includes('JOBAD_USE') ? [{ jobAdId: { not: null } }] : []),
            ],
        })),
    },
    readMany: {
        authorizer: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    },
    readTargets: {
        authorizer: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    },
    update: {
        params: id,
        data: highlight,
        authorizer: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    },
    destroy: {
        params: id,
        authorizer: Require.permission('CAREER_FRONTPAGE_HIGHLIGHT_ADMIN'),
    },
})
