import '@pn-server-only'
import { committeeParticipationAuth } from './auth'
import { committeeParticipationSchemas } from './schemas'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { cmsLinkOperations } from '@/cms/links/operations'
import { defineOperation } from '@/services/serviceOperation'
import { expandedImageIncluder } from '@/services/images/subservice/constants'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

async function readParticipationOwner(
    prisma: PrismaPossibleTransaction<false>,
    participationId: number,
) {
    const participation = await prisma.committeeParticipationInApplicationPeriod.findUniqueOrThrow({
        where: { id: participationId },
        select: {
            paragraphId: true,
            videoLinkId: true,
            committee: { select: { groupId: true } },
        },
    })
    return { ...participation, groupId: participation.committee.groupId }
}

export const committeeParticipationOperations = {
    read: defineOperation({
        paramsSchema: committeeParticipationSchemas.params.read,
        authorizer: async ({ prisma, params }) => committeeParticipationAuth.read.data({
            groupId: (await readParticipationOwner(prisma, params.participationId)).groupId
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
        paramsSchema: committeeParticipationSchemas.params.readAll,
        authorizer: async ({ prisma, params }) => committeeParticipationAuth.readAll.data({
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
    }),

    updateParagraphContent: cmsParagraphOperations.updateContent.implement({
        implementationParamsSchema: committeeParticipationSchemas.params.updateParagraphContent,
        authorizer: async ({ prisma, implementationParams }) =>
            committeeParticipationAuth.updateParagraphContent.data({
                groupId: (await readParticipationOwner(prisma, implementationParams.participationId)).groupId
            }),
        ownershipCheck: async ({ prisma, implementationParams, params }) =>
            (await readParticipationOwner(prisma, implementationParams.participationId)).paragraphId
                === params.paragraphId,
    }),

    updateVideoLink: cmsLinkOperations.update.implement({
        implementationParamsSchema: committeeParticipationSchemas.params.updateVideoLink,
        authorizer: async ({ prisma, implementationParams }) =>
            committeeParticipationAuth.updateVideoLink.data({
                groupId: (await readParticipationOwner(prisma, implementationParams.participationId)).groupId
            }),
        ownershipCheck: async ({ prisma, implementationParams, params }) =>
            (await readParticipationOwner(prisma, implementationParams.participationId)).videoLinkId
                === params.linkId,
    }),
} as const
