import '@pn-server-only'
import { applicationAuth } from './auth'
import { applicationSchemas } from './schemas'
import { renumberApplicationPriorities } from './renumberPriorities'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'

const applicationWhere = ({ userId, committeeParticipationId }: { userId: number, committeeParticipationId: number }) => ({
    userId_applicationPeriodCommitteeId: {
        userId,
        applicationPeriodCommitteeId: committeeParticipationId,
    },
})

export const applicationOperations = {
    readForUser: defineOperation({
        paramsSchema: applicationSchemas.params.readForUser,
        authorizer: ({ params }) => applicationAuth.readForUser.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => prisma.application.findMany({
            where: {
                userId: params.userId,
                applicationPeriodId: params.periodId
            }
        })
    }),

    create: defineOperation({
        dataSchema: applicationSchemas.data.create,
        paramsSchema: applicationSchemas.params.create,
        authorizer: ({ params }) => applicationAuth.create.data({ userId: params.userId }),
        operation: async ({ prisma, data, params }) => {
            const committeeParticipation = await prisma.committeeParticipationInApplicationPeriod.findUniqueOrThrow({
                where: {
                    id: params.committeeParticipationId
                },
                select: {
                    applicationPeriod: {
                        select: {
                            id: true,
                            startDate: true,
                            endDate: true,
                        }
                    }
                }
            })

            if (Date.now() < committeeParticipation.applicationPeriod.startDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application period has not started yet.'
                )
            } else if (Date.now() > committeeParticipation.applicationPeriod.endDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application period has ended.'
                )
            }

            const usersLowestPriorityApplicationInPeriod = await prisma.application.findFirst({
                where: {
                    userId: params.userId,
                    applicationPeriodId: committeeParticipation.applicationPeriod.id
                },
                orderBy: {
                    priority: 'desc'
                },
                select: {
                    priority: true
                }
            }).then(application => application?.priority ?? 0)

            await prisma.application.create({
                data: {
                    text: data.text,
                    userId: params.userId,
                    applicationPeriodCommitteeId: params.committeeParticipationId,
                    applicationPeriodId: committeeParticipation.applicationPeriod.id,
                    priority: usersLowestPriorityApplicationInPeriod + 1,
                }
            })
        },
    }),

    update: defineOperation({
        dataSchema: applicationSchemas.data.update,
        paramsSchema: applicationSchemas.params.update,
        opensTransaction: true,
        authorizer: ({ params }) => applicationAuth.update.data({ userId: params.userId }),
        operation: async ({ prisma, data, params }) => prisma.$transaction(async (tx) => {
            const application = await tx.application.findUniqueOrThrow({
                where: applicationWhere(params),
                select: {
                    id: true,
                    priority: true,
                    applicationPeriodId: true,
                    applicationPeriodCommittee: {
                        select: {
                            applicationPeriod: {
                                select: {
                                    endDate: true,
                                    startDate: true,
                                    endPriorityDate: true
                                }
                            }
                        }
                    }
                }
            })
            const { startDate, endDate, endPriorityDate } = application.applicationPeriodCommittee.applicationPeriod
            if (Date.now() < startDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application period has not started yet.'
                )
            }

            if (data.text !== undefined) {
                if (Date.now() > endDate.getTime()) {
                    throw new ServiceError(
                        'BAD PARAMETERS', 'The application period has ended.'
                    )
                }
                await tx.application.update({
                    where: { id: application.id },
                    data: { text: data.text },
                })
            }
            if (data.priority === undefined) return
            if (Date.now() > endPriorityDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The priority period has ended.'
                )
            }

            const newPriority = data.priority === 'UP' ? application.priority - 1 : application.priority + 1
            const otherApplication = await tx.application.findFirst({
                where: {
                    userId: params.userId,
                    applicationPeriodId: application.applicationPeriodId,
                    priority: newPriority,
                },
                select: { id: true },
            })

            if (!otherApplication) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application is already at the top or bottom of the priority list.'
                )
            }
            // Swapped by way of -1: (userId, applicationPeriodId, priority) is unique, so neither
            // application can take the other's priority while it is still held.
            await tx.application.update({ where: { id: application.id }, data: { priority: -1 } })
            await tx.application.update({ where: { id: otherApplication.id }, data: { priority: application.priority } })
            await tx.application.update({ where: { id: application.id }, data: { priority: newPriority } })
        }),
    }),

    destroy: defineOperation({
        paramsSchema: applicationSchemas.params.destroy,
        authorizer: ({ params }) => applicationAuth.destroy.data({ userId: params.userId }),
        opensTransaction: true,
        operation: async ({ prisma, params }) => prisma.$transaction(async (tx) => {
            const application = await tx.application.findUniqueOrThrow({
                where: applicationWhere(params),
                select: {
                    id: true,
                    applicationPeriodId: true,
                    applicationPeriodCommittee: {
                        select: {
                            applicationPeriod: {
                                select: {
                                    endDate: true,
                                }
                            }
                        }
                    }
                }
            })
            if (Date.now() > application.applicationPeriodCommittee.applicationPeriod.endDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application period has ended.'
                )
            }
            await tx.application.delete({ where: { id: application.id } })
            await renumberApplicationPriorities(tx, {
                applicationPeriodId: application.applicationPeriodId,
                userIds: [params.userId],
            })
        }),
    }),
} as const
