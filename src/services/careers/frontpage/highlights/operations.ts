import '@ow-server-only'
import { careerFrontpageHighlightContract } from './contract'
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
import { activeJobAdOrdering } from '@/services/careers/jobAds/constants'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import type { CareerFrontpageHighlightTargets, ExpandedCareerFrontpageHighlight } from './types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

export const careerFrontpageHighlightOperations = {
    create: defineOperation(careerFrontpageHighlightContract.create, {
        operation: async ({ prisma, data }) => {
            await assertCanBeHighlighted(prisma, data)
            return prisma.careerFrontpageHighlight.create({ data })
        },
    }),
    /** The highlights to show now. Each one also ends when its event does, should the event be moved earlier. */
    readCurrent: defineOperation(careerFrontpageHighlightContract.readCurrent, {
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
    readMany: defineOperation(careerFrontpageHighlightContract.readMany, {
        operation: async ({ prisma }): Promise<ExpandedCareerFrontpageHighlight[]> => (
            await prisma.careerFrontpageHighlight.findMany({
                orderBy: adminHighlightOrdering,
                select: careerFrontpageHighlightSelection,
            })
        ),
    }),
    readTargets: defineOperation(careerFrontpageHighlightContract.readTargets, {
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
    update: defineOperation(careerFrontpageHighlightContract.update, {
        operation: async ({ prisma, params: { id }, data }) => {
            await assertCanBeHighlighted(prisma, data)
            return prisma.careerFrontpageHighlight.update({ where: { id }, data })
        },
    }),
    destroy: defineOperation(careerFrontpageHighlightContract.destroy, {
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
        throw new ServiceError('BAD PARAMETERS', 'Velg enten en bedriftspresentasjon eller en jobbannonse')
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
            throw new ServiceError('BAD PARAMETERS', 'Bare publiserte bedriftspresentasjoner kan fremheves')
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
