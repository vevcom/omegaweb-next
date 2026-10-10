import '@pn-server-only'
import { committeeParticipationAuth } from './auth'
import { defineOperation } from '@/services/serviceOperation'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { z } from 'zod'

export const committeeParticipationOperations = {
    read: defineOperation({
        paramsSchema: z.object({
            participationId: z.number(),
        }),
        authorizer: async ({ prisma, params }) => committeeParticipationAuth.read.data({
            groupId: await prisma.committeeParticipationInApplicationPeriod.findUniqueOrThrow({
                where: {
                    id: params.participationId
                },
                select: {
                    committee: {
                        select: {
                            group: {
                                select: {
                                    id: true,
                                }
                            }
                        }
                    }
                }
            }).then((participation) => participation.committee.group.id)
        }),
        operation: async ({ prisma, params }) => {
            const defaultProfileImage = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })
            const participation = await prisma.committeeParticipationInApplicationPeriod.findUniqueOrThrow({
                where: {
                    id: params.participationId
                },
                select: {
                    applications: {
                        select: {
                            priority: true,
                            text: true,
                            user: {
                                select: {
                                    firstname: true,
                                    lastname: true,
                                    image: { include: expandedImageIncluder },
                                    email: true,
                                    username: true,
                                }
                            }
                        }
                    }
                }
            })
            return participation.applications.map(application => ({
                ...application,
                user: {
                    ...application.user,
                    image: application.user.image ?? defaultProfileImage,
                }
            }))
        }
    }),
    readAll: defineOperation({
        paramsSchema: z.object({
            committeeId: z.number(),
        }),
        authorizer: async ({ prisma, params }) => committeeParticipationAuth.read.data({
            groupId: await prisma.committee.findUniqueOrThrow({
                where: {
                    id: params.committeeId
                },
                select: {
                    groupId: true
                }
            }).then((committee) => committee.groupId)
        }),
        operation: async ({ prisma, params }) => (
            await prisma.committeeParticipationInApplicationPeriod.findMany({
                where: {
                    committeeId: params.committeeId
                },
                select: {
                    _count: {
                        select: {
                            applications: true,
                        }
                    },
                    id: true,
                    applicationPeriod: {
                        select: {
                            startDate: true,
                            endPriorityDate: true,
                            endDate: true,
                        }
                    }
                }
            }).then((participationRows) => participationRows.map((participation) => (
                {
                    participationId: participation.id,
                    applicationCount: participation._count.applications,
                    startDate: participation.applicationPeriod.startDate,
                    endDate: participation.applicationPeriod.endDate,
                    endPriorityDate: participation.applicationPeriod.endPriorityDate,
                    isOpen: (Date.now() > participation.applicationPeriod.startDate.getTime())
                            &&
                            (Date.now() < participation.applicationPeriod.endPriorityDate.getTime())
                })
            )
            )
        )
    })
} as const
