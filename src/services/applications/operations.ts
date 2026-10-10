import '@pn-server-only'
import { applicationAuth } from './auth'
import { applicationSchemas } from './schemas'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { z } from 'zod'

export const applicationOperations = {
    readForUser: defineOperation({
        paramsSchema: z.object({
            userId: z.number(),
            periodId: z.number()
        }),
        authorizer: ({ params }) => applicationAuth.readForUser.data({ userId: params.userId }),
        operation: async ({ prisma, params }) => prisma.application.findMany({
            where: {
                userId: params.userId,
                applicationPeriodId: params.periodId
            }
        })
    }),

    create: defineOperation({
        dataSchema: applicationSchemas.create,
        paramsSchema: z.object({
            userId: z.number(),
            committeeParticipationId: z.number()
        }),
        authorizer: ({ params }) => applicationAuth.create.data({ userId: params.userId }),
        operation: async ({ prisma, data, params }) => {
            const commiteeParticipation = await prisma.committeeParticipationInApplicationPeriod.findUniqueOrThrow({
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

            if (Date.now() < commiteeParticipation.applicationPeriod.startDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application period has not started yet.'
                )
            } else if (Date.now() > commiteeParticipation.applicationPeriod.endDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application period has ended.'
                )
            }

            const usersLowestPriorityApplicationInPeriod = await prisma.application.findFirst({
                where: {
                    userId: params.userId,
                    applicationPeriodId: commiteeParticipation.applicationPeriod.id
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
                    applicationPeriodCommiteeId: params.committeeParticipationId,
                    applicationPeriodId: commiteeParticipation.applicationPeriod.id,
                    priority: usersLowestPriorityApplicationInPeriod + 1,
                }
            })
        },
    }),

    update: defineOperation({
        dataSchema: applicationSchemas.update,
        paramsSchema: z.object({
            userId: z.number(),
            committeeParticipationId: z.number()
        }),
        opensTransaction: true,
        authorizer: ({ params }) => applicationAuth.update.data({ userId: params.userId }),
        operation: async ({ prisma, data, params }) => {
            const application = await prisma.application.findUniqueOrThrow({
                where: {
                    userId_applicationPeriodCommiteeId: {
                        userId: params.userId,
                        applicationPeriodCommiteeId: params.committeeParticipationId
                    },
                },
                select: {
                    priority: true,
                    applicationPeriodId: true,
                    applicationPeriodCommitee: {
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
            const { startDate, endDate, endPriorityDate } = application.applicationPeriodCommitee.applicationPeriod
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
                await prisma.application.update({
                    where: {
                        userId_applicationPeriodCommiteeId: {
                            userId: params.userId,
                            applicationPeriodCommiteeId: params.committeeParticipationId
                        }
                    },
                    data: {
                        text: data.text
                    }
                })
            }
            if (data.priority === undefined) return
            if (Date.now() > endPriorityDate.getTime()) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The priority period has ended.'
                )
            }

            const otherApplication = await prisma.application.findFirst({
                where: {
                    userId: params.userId,
                    applicationPeriodId: application.applicationPeriodId,
                    priority: data.priority === 'UP' ? application.priority - 1 : application.priority + 1
                }
            })

            if (!otherApplication) {
                throw new ServiceError(
                    'BAD PARAMETERS', 'The application is already at the top or bottom of the priority list.'
                )
            }
            // Swap the priorities if the other application exists.
            // Must temporarly change the priority to -1 to avoid unique constraint violation
            prisma.$transaction(async (tx) => {
                await tx.application.update({
                    where: {
                        userId_applicationPeriodCommiteeId: {
                            userId: params.userId,
                            applicationPeriodCommiteeId: params.committeeParticipationId
                        }
                    },
                    data: {
                        priority: -1 // Temporarily set to -1 to avoid unique constraint violation
                    }
                })

                await tx.application.update({
                    where: {
                        id: otherApplication.id
                    },
                    data: {
                        priority: application.priority
                    }
                })

                await tx.application.update({
                    where: {
                        userId_applicationPeriodCommiteeId: {
                            userId: params.userId,
                            applicationPeriodCommiteeId: params.committeeParticipationId
                        }
                    },
                    data: {
                        priority: data.priority === 'UP' ? application.priority - 1 : application.priority + 1
                    }
                })
            })
        },
    }),

    destroy: defineOperation({
        paramsSchema: z.object({
            userId: z.number(),
            committeeParticipationId: z.number()
        }),
        authorizer: ({ params }) => applicationAuth.destroy.data({ userId: params.userId }),
        opensTransaction: true,
        operation: async ({ prisma, params }) => {
            prisma.$transaction(async (tx) => {
                const application = await tx.application.delete({
                    where: {
                        userId_applicationPeriodCommiteeId: {
                            userId: params.userId,
                            applicationPeriodCommiteeId: params.committeeParticipationId
                        }
                    },
                    select: {
                        priority: true,
                        applicationPeriodId: true,
                        applicationPeriodCommitee: {
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
                if (Date.now() > application.applicationPeriodCommitee.applicationPeriod.endDate.getTime()) {
                    throw new ServiceError(
                        'BAD PARAMETERS', 'The application period has ended.'
                    )
                }
                await tx.application.updateMany({
                    where: {
                        userId: params.userId,
                        applicationPeriodId: application.applicationPeriodId,
                        priority: {
                            gt: application.priority
                        }
                    },
                    data: {
                        priority: {
                            decrement: 1
                        }
                    }
                })
            })
        }
    }),
} as const
