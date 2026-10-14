import '@pn-server-only'
import { applicationPeriodAuth } from './auth'
import { applicationPeriodSchemas, periodDatesInOrder, periodDatesMessage } from './schemas'
import { committeesParticipatingIncluder } from './constants'
import { renumberApplicationPriorities } from '@/services/applications/renumberPriorities'
import { videoLinkDefaultText, videoLinkUnsetUrl } from '@/services/applications/committeeParticipation/constants'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import type { Prisma } from '@/prisma-generated-pn-types'

// One at a time rather than createMany: each participation needs a paragraph and a link made
// through the CMS services first.
async function createParticipations(
    tx: Prisma.TransactionClient,
    { applicationPeriodId, committeeIds }: { applicationPeriodId: number, committeeIds: number[] },
) {
    await committeeIds.reduce(async (previous, committeeId) => {
        await previous
        const paragraph = await cmsParagraphOperations.create.internalCall({
            prisma: tx,
            data: {},
            operationImplementationFields: { special: null },
        })
        const videoLink = await cmsLinkOperations.create.internalCall({
            prisma: tx,
            data: { text: videoLinkDefaultText, url: videoLinkUnsetUrl },
        })
        await tx.committeeParticipationInApplicationPeriod.create({
            data: {
                applicationPeriodId,
                committeeId,
                paragraphId: paragraph.id,
                videoLinkId: videoLink.id,
            },
        })
    }, Promise.resolve())
}

// Deleting a participation leaves its paragraph and link behind, so they go by hand.
async function destroyParticipationCmsParts(
    tx: Prisma.TransactionClient,
    participations: { paragraphId: number, videoLinkId: number }[],
) {
    await participations.reduce(async (previous, participation) => {
        await previous
        await cmsParagraphOperations.destroy.internalCall({
            prisma: tx,
            params: { paragraphId: participation.paragraphId },
        })
        await cmsLinkOperations.destroy.internalCall({
            prisma: tx,
            params: { linkId: participation.videoLinkId },
        })
    }, Promise.resolve())
}

export const applicationPeriodOperations = {
    readAll: defineOperation({
        authorizer: () => applicationPeriodAuth.readAll,
        operation: async ({ prisma }) => prisma.applicationPeriod.findMany()
    }),

    read: defineOperation({
        authorizer: () => applicationPeriodAuth.read,
        paramsSchema: applicationPeriodSchemas.params.read,
        operation: async ({ prisma, params }) => {
            // committee.logoImage is null unless the committee has its own uploaded logo -
            // resolve it to the shared default here so callers never see a null logo.
            const defaultCommitteeLogo = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_COMMITTEE_LOGO' },
            })

            const period = await prisma.applicationPeriod.findUniqueOrThrow({
                where: { name: params.name },
                include: committeesParticipatingIncluder,
            })

            return {
                ...period,
                committeesParticipating: period.committeesParticipating.map(participation => ({
                    ...participation,
                    committee: {
                        ...participation.committee,
                        logoImage: participation.committee.logoImage ?? defaultCommitteeLogo
                    }
                }))
            }
        }
    }),

    create: defineOperation({
        authorizer: () => applicationPeriodAuth.create,
        dataSchema: applicationPeriodSchemas.data.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => prisma.$transaction(async (tx) => {
            const period = await tx.applicationPeriod.create({
                data: {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    endPriorityDate: data.endPriorityDate,
                },
                select: { id: true, name: true },
            })
            await createParticipations(tx, {
                applicationPeriodId: period.id,
                committeeIds: data.participatingCommitteeIds,
            })
            return { name: period.name }
        })
    }),

    update: defineOperation({
        authorizer: () => applicationPeriodAuth.update,
        dataSchema: applicationPeriodSchemas.data.update,
        paramsSchema: applicationPeriodSchemas.params.update,
        opensTransaction: true,
        operation: async ({ prisma, data, params }) => prisma.$transaction(async (tx) => {
            const current = await tx.applicationPeriod.findUniqueOrThrow({
                where: { name: params.name },
                select: { id: true, startDate: true, endDate: true, endPriorityDate: true },
            })
            if (!periodDatesInOrder({ ...current, ...data })) {
                throw new ServiceError('BAD PARAMETERS', periodDatesMessage)
            }

            const period = await tx.applicationPeriod.update({
                where: { id: current.id },
                data: {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    endPriorityDate: data.endPriorityDate,
                },
                select: { id: true, name: true },
            })

            const participatingCommitteeIds = data.participatingCommitteeIds
            if (participatingCommitteeIds) {
                const participations = await tx.committeeParticipationInApplicationPeriod.findMany({
                    where: { applicationPeriodId: period.id },
                    select: { id: true, committeeId: true, paragraphId: true, videoLinkId: true },
                })
                const leaving = participations.filter(
                    participation => !participatingCommitteeIds.includes(participation.committeeId)
                )

                // The applications to a committee that leaves the period go with it (the
                // participation cascades), which leaves gaps in the priorities of whoever applied.
                const applicants = await tx.application.findMany({
                    where: {
                        applicationPeriodId: period.id,
                        applicationPeriodCommitteeId: { in: leaving.map(participation => participation.id) },
                    },
                    select: { userId: true },
                    distinct: ['userId'],
                })
                await tx.committeeParticipationInApplicationPeriod.deleteMany({
                    where: { id: { in: leaving.map(participation => participation.id) } }
                })
                await destroyParticipationCmsParts(tx, leaving)
                await createParticipations(tx, {
                    applicationPeriodId: period.id,
                    committeeIds: participatingCommitteeIds.filter(committeeId =>
                        !participations.some(participation => participation.committeeId === committeeId)
                    ),
                })
                await renumberApplicationPriorities(tx, {
                    applicationPeriodId: period.id,
                    userIds: applicants.map(applicant => applicant.userId),
                })
            }

            return { name: period.name }
        }),
    }),

    removeAllApplicationTexts: defineOperation({
        paramsSchema: applicationPeriodSchemas.params.removeAllApplicationTexts,
        authorizer: () => applicationPeriodAuth.removeAllApplicationTexts,
        operation: async ({ prisma, params }) => {
            const period = await prisma.applicationPeriod.findUniqueOrThrow({
                where: { name: params.name },
                select: { id: true, endPriorityDate: true },
            })
            if (period.endPriorityDate.getTime() > Date.now()) {
                throw new ServiceError(
                    'DISSALLOWED', 'You cannot remove application texts before the end of the priority date.'
                )
            }
            await prisma.application.updateMany({
                where: {
                    applicationPeriodId: period.id
                },
                data: {
                    text: 'SLETTET TEKST',
                }
            })
        }
    }),

    destroy: defineOperation({
        authorizer: () => applicationPeriodAuth.destroy,
        paramsSchema: applicationPeriodSchemas.params.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async (tx) => {
            const period = await tx.applicationPeriod.findUniqueOrThrow({
                where: { name: params.name },
                select: {
                    id: true,
                    committeesParticipating: { select: { paragraphId: true, videoLinkId: true } },
                },
            })
            await tx.applicationPeriod.delete({ where: { id: period.id } })
            await destroyParticipationCmsParts(tx, period.committeesParticipating)
        })
    }),

    readNumberOfApplications: defineOperation({
        authorizer: () => applicationPeriodAuth.readNumberOfApplications,
        paramsSchema: applicationPeriodSchemas.params.readNumberOfApplications,
        operation: async ({ prisma, params }) => {
            const period = await prisma.applicationPeriod.findUniqueOrThrow({
                where: { name: params.name },
                select: {
                    id: true
                },
            })
            return await prisma.application.count({
                where: {
                    applicationPeriodId: period.id
                },
            })
        }
    }),
} as const
