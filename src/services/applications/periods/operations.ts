import '@pn-server-only'
import { applicationPeriodAuth } from './auth'
import { applicationPeriodSchemas, periodDatesInOrder, periodDatesMessage } from './schemas'
import { committeesParticipatingIncluder } from './constants'
import { renumberApplicationPriorities } from '@/services/applications/renumberPriorities'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'

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
        operation: async ({ prisma, data }) => {
            await prisma.applicationPeriod.create({
                data: {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    endPriorityDate: data.endPriorityDate,
                    committeesParticipating: {
                        create: data.participatingCommitteeIds.map(id => ({ committeeId: id }))
                    }
                }
            })
            return { name: data.name }
        }
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

            if (data.participatingCommitteeIds) {
                // The applications to a committee that leaves the period go with it (the
                // participation cascades), which leaves gaps in the priorities of whoever applied.
                const applicants = await tx.application.findMany({
                    where: {
                        applicationPeriodId: period.id,
                        applicationPeriodCommitee: { committeeId: { notIn: data.participatingCommitteeIds } },
                    },
                    select: { userId: true },
                    distinct: ['userId'],
                })
                await tx.committeeParticipationInApplicationPeriod.deleteMany({
                    where: {
                        applicationPeriodId: period.id,
                        committeeId: { notIn: data.participatingCommitteeIds },
                    }
                })
                await tx.committeeParticipationInApplicationPeriod.createMany({
                    data: data.participatingCommitteeIds.map(committeeId => ({
                        applicationPeriodId: period.id,
                        committeeId,
                    })),
                    skipDuplicates: true
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
        operation: async ({ prisma, params }) => {
            await prisma.applicationPeriod.delete({
                where: { name: params.name }
            })
        }
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
