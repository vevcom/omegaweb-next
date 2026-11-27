import '@ow-server-only'
import { careerFrontpageHighlightAuth } from './auth'
import {
    adminHighlightOrdering,
    careerFrontpageHighlightSelection,
    currentHighlightOrdering,
    currentlyHighlightableEvent,
    highlightableEvent,
    highlightableEventSelection,
    highlightableJobAd,
    highlightableJobAdSelection,
} from './constants'
import { careerFrontpageHighlightSchemas } from './schemas'
import { activeJobAdOrdering } from '@/services/careers/jobAds/constants'
import { eventHomePages } from '@/pageKits/events/homePages'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import type { CareerFrontpageHighlightTargets, ExpandedCareerFrontpageHighlight } from './types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

export const careerFrontpageHighlightOperations = {
    create: defineOperation({
        dataSchema: careerFrontpageHighlightSchemas.data.create,
        authorizer: () => careerFrontpageHighlightAuth.create,
        operation: async ({ prisma, data }) => {
            await assertCanBeHighlighted(prisma, data)
            return prisma.careerFrontpageHighlight.create({ data })
        },
    }),
    /** The highlights to show now. Each one also ends when its event does, should the event be moved earlier. */
    readCurrent: defineOperation({
        authorizer: () => careerFrontpageHighlightAuth.readCurrent,
        operation: async ({ prisma }, prismaWhereFilter): Promise<ExpandedCareerFrontpageHighlight[]> => {
            const now = new Date()
            return await prisma.careerFrontpageHighlight.findMany({
                where: {
                    ...prismaWhereFilter,
                    start: { lte: now },
                    end: { gte: now },
                    AND: {
                        OR: [
                            { event: currentlyHighlightableEvent(now) },
                            { jobAd: highlightableJobAd },
                        ],
                    },
                },
                orderBy: currentHighlightOrdering,
                select: careerFrontpageHighlightSelection,
            })
        },
    }),
    readMany: defineOperation({
        authorizer: () => careerFrontpageHighlightAuth.readMany,
        operation: async ({ prisma }): Promise<ExpandedCareerFrontpageHighlight[]> => (
            await prisma.careerFrontpageHighlight.findMany({
                orderBy: adminHighlightOrdering,
                select: careerFrontpageHighlightSelection,
            })
        ),
    }),
    readTargets: defineOperation({
        authorizer: () => careerFrontpageHighlightAuth.readTargets,
        operation: async ({ prisma }): Promise<CareerFrontpageHighlightTargets> => {
            const [events, jobAds] = await Promise.all([
                prisma.event.findMany({
                    where: currentlyHighlightableEvent(new Date()),
                    orderBy: { eventStart: 'asc' },
                    select: highlightableEventSelection,
                }),
                prisma.jobAd.findMany({
                    where: highlightableJobAd,
                    orderBy: activeJobAdOrdering,
                    select: highlightableJobAdSelection,
                }),
            ])
            return { events, jobAds }
        },
    }),
    update: defineOperation({
        paramsSchema: careerFrontpageHighlightSchemas.params.update,
        dataSchema: careerFrontpageHighlightSchemas.data.update,
        authorizer: () => careerFrontpageHighlightAuth.update,
        operation: async ({ prisma, params: { id }, data }) => {
            await assertCanBeHighlighted(prisma, data)
            return prisma.careerFrontpageHighlight.update({ where: { id }, data })
        },
    }),
    destroy: defineOperation({
        paramsSchema: careerFrontpageHighlightSchemas.params.destroy,
        authorizer: () => careerFrontpageHighlightAuth.destroy,
        operation: async ({ prisma, params: { id } }) => {
            await prisma.careerFrontpageHighlight.delete({ where: { id } })
        },
    }),
} as const

async function assertCanBeHighlighted(
    prisma: PrismaPossibleTransaction<false>,
    { eventId, jobAdId, start, end }: { eventId: number | null, jobAdId: number | null, start: Date, end: Date },
) {
    if ((eventId === null) === (jobAdId === null)) {
        throw new ServiceError('BAD PARAMETERS', 'Velg enten et arrangement eller en jobbannonse')
    }
    if (start >= end) {
        throw new ServiceError('BAD PARAMETERS', 'Fremhevingen må starte før den slutter')
    }
    if (eventId !== null) {
        const event = await prisma.event.findFirst({
            where: { id: eventId, ...highlightableEvent },
            select: { eventEnd: true },
        })
        if (!event) {
            const kinds = highlightableEvent.kind.in.map(kind => eventHomePages[kind].titles.current.toLowerCase())
            throw new ServiceError('BAD PARAMETERS', `Bare publiserte ${kinds.join(' og ')} kan fremheves`)
        }
        if (end > event.eventEnd) {
            throw new ServiceError('BAD PARAMETERS', 'Fremhevingen kan ikke slutte etter arrangementet')
        }
    }
    if (jobAdId !== null) {
        const jobAd = await prisma.jobAd.findFirst({ where: { id: jobAdId, ...highlightableJobAd }, select: { id: true } })
        if (!jobAd) {
            throw new ServiceError('BAD PARAMETERS', 'Bare aktive jobbannonser kan fremheves')
        }
    }
}
