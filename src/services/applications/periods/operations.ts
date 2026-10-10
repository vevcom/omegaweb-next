import '@pn-server-only'
import { applicationPeriodAuth } from './auth'
import { applicationPeriodSchemas } from './schemas'
import { committeesParticipatingIncluder } from './constants'
import { applicationOperations } from '@/services/applications/operations'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'

export const applicationPeriodOperations = {
    readAll: defineOperation({
        authorizer: () => applicationPeriodAuth.readAll,
        operation: async ({ prisma }) => prisma.applicationPeriod.findMany()
    }),

    read: defineOperation({
        authorizer: () => applicationPeriodAuth.read,
        paramsSchema: z.object({
            name: z.string()
        }),
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
        dataSchema: applicationPeriodSchemas.create,
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
        dataSchema: applicationPeriodSchemas.update,
        paramsSchema: z.object({
            name: z.string()
        }),
        operation: async ({ prisma, data, params }) => {
            const period = await prisma.applicationPeriod.update({
                where: { name: params.name },
                data: {
                    name: data.name,
                    startDate: data.startDate,
                    endDate: data.endDate,
                    endPriorityDate: data.endPriorityDate,
                },
                include: {
                    committeesParticipating: {
                        select: {
                            committeeId: true
                        },
                    },
                },
            })

            if (data.participatingCommitteeIds) {
                // Remove applications to committees that are no longer participating
                // This must be done through the applicationOperations.destroy method to ensure
                // that reordering priorities is handled correctly.
                await Promise.all(
                    period.committeesParticipating
                        .map(committee => committee.committeeId)
                        .filter(id => !(data.participatingCommitteeIds ?? []).includes(id))
                        .map(async id => {
                            const removeApplications = await prisma.application.findMany({
                                where: {
                                    applicationPeriodId: period.id,
                                    applicationPeriodCommitee: {
                                        committeeId: id
                                    }
                                },
                                select: {
                                    userId: true,
                                    applicationPeriodCommiteeId: true
                                }
                            })
                            await Promise.all(
                                removeApplications.map(async application =>
                                    await applicationOperations.destroy({
                                        params: {
                                            userId: application.userId,
                                            committeeParticipationId: application.applicationPeriodCommiteeId
                                        },
                                    })
                                )
                            )
                        })
                )

                await prisma.committeeParticipationInApplicationPeriod.createMany({
                    data: data.participatingCommitteeIds.map(id => ({
                        applicationPeriodId: period.id,
                        committeeId: id
                    })),
                    skipDuplicates: true
                })
                await prisma.committeeParticipationInApplicationPeriod.deleteMany({
                    where: {
                        applicationPeriodId: period.id,
                        committeeId: {
                            notIn: data.participatingCommitteeIds
                        }
                    }
                })
            }

            return { name: period.name }
        }
    }),

    removeAllApplicationTexts: defineOperation({
        paramsSchema: z.object({
            name: z.string()
        }),
        authorizer: () => applicationPeriodAuth.removeAllApplicationTexts,
        operation: async ({ prisma, params, session }) => {
            const period = await applicationPeriodOperations.read({
                params: { name: params.name },
                session
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
        paramsSchema: z.object({
            name: z.string()
        }),
        operation: async ({ prisma, params }) => {
            await prisma.applicationPeriod.delete({
                where: { name: params.name }
            })
        }
    }),

    readNumberOfApplications: defineOperation({
        authorizer: () => applicationPeriodAuth.readNumberOfApplications,
        paramsSchema: z.object({
            name: z.string()
        }),
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
