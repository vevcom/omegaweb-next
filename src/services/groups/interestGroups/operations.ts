import '@pn-server-only'
import { interestGroupAuth } from './auth'
import { interestGroupSchemas } from './schemas'
import { groupOperations } from '@/services/groups/operations'
import { invalidateManyUserSessionData } from '@/services/auth/invalidateSession'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { articleSectionsRelationsIncluder } from '@/services/cms/articleSections/constants'
import { defineOperation } from '@/services/serviceOperation'
import {
    implementGroupType,
    implementManualMigrationPerGroup,
    implementSimpleAddRemoveMembersOperation,
} from '@/services/groups/implementGroupType'
import { GroupType } from '@/prisma-generated-pn-types'
import { cmsParagraphOperations } from '@/cms/paragraphs/operations'
import { implementUpdateArticleSectionOperations } from '@/cms/articleSections/implement'
import { ServiceError } from '@/services/error'
import { z } from 'zod'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

const commonGroupOperations = implementGroupType({
    type: GroupType.INTEREST_GROUP,
    auth: {
        readExpanded: interestGroupAuth.readExpanded,
        readMembers: ({ groupId }) => interestGroupAuth.readMembers.data({ groupId }),
        readMembershipsOfUser: ({ userId }) => interestGroupAuth.readMembershipsOfUser.data({ userId }),
    },
})

const memberManagement = implementSimpleAddRemoveMembersOperation({
    type: GroupType.INTEREST_GROUP,
    auth: {
        addMembers: ({ groupId }) => interestGroupAuth.addMembers.data({ groupId }),
        removeMembers: ({ groupId }) => interestGroupAuth.removeMembers.data({ groupId }),
        setMemberAdmin: ({ groupId }) => interestGroupAuth.setMemberAdmin.data({ groupId }),
        setMemberTitle: ({ groupId }) => interestGroupAuth.setMemberTitle.data({ groupId }),
    },
})

const migration = implementManualMigrationPerGroup({
    type: GroupType.INTEREST_GROUP,
    auth: {
        migrateGroup: ({ groupId }) => interestGroupAuth.migrateGroup.data({ groupId }),
        pension: () => interestGroupAuth.pension,
    },
    setPensioned: (prisma, groupId, pensioned) => prisma.interestGroup.update({
        where: { groupId },
        data: { pensioned },
    }),
})

/**
 * A pensioned interest group is history: nothing about it may be changed until someone brings it
 * back. The check sits on every operation that writes.
 */
async function assertNotPensioned(prisma: PrismaPossibleTransaction<false>, id: number) {
    const interestGroup = await prisma.interestGroup.findUniqueOrThrow({
        where: { id },
        select: { name: true, pensioned: true },
    })

    if (interestGroup.pensioned) {
        throw new ServiceError(
            'BAD PARAMETERS',
            `${interestGroup.name} er pensjonert og kan ikke endres. Gjenopprett gruppen først.`
        )
    }
}

export const interestGroupOperations = {
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    addMembers: memberManagement.addMembers,
    removeMembers: memberManagement.removeMembers,
    setMemberAdmin: memberManagement.setMemberAdmin,
    setMemberTitle: memberManagement.setMemberTitle,
    migrateGroup: migration.migrateGroup,
    pension: migration.pension,
    create: defineOperation({
        dataSchema: interestGroupSchemas.create,
        authorizer: () => interestGroupAuth.create,
        operation: async ({ prisma, data }) => {
            const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            await prisma.interestGroup.create({
                data: {
                    ...data,
                    articleSection: {
                        create: {
                            cmsImage: {},
                            cmsParagraph: {},
                            cmsLink: {},
                        }
                    },
                    group: {
                        create: {
                            groupType: 'INTEREST_GROUP',
                            order,
                        }
                    }
                }
            })
        }
    }),

    readMany: defineOperation({
        authorizer: () => interestGroupAuth.readMany,
        operation: ({ prisma }) => prisma.interestGroup.findMany({
            include: {
                articleSection: {
                    include: articleSectionsRelationsIncluder,
                },
            },
            orderBy: [
                { name: 'asc' },
                { id: 'asc' },
            ]
        })
    }),

    read: defineOperation({
        paramsSchema: z.object({
            id: z.number().optional(),
        }),
        authorizer: () => interestGroupAuth.read,
        operation: async ({ prisma, params: { id } }) => await prisma.interestGroup.findUniqueOrThrow({
            where: {
                id,
            },
            include: {
                articleSection: {
                    include: articleSectionsRelationsIncluder,
                },
            }
        })
    }),

    update: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        dataSchema: interestGroupSchemas.update,
        authorizer: async ({ prisma, params }) => {
            const { groupId } = await prisma.interestGroup.findUniqueOrThrow({
                where: { id: params.id },
                select: { groupId: true },
            })

            return interestGroupAuth.update.data({ groupId })
        },
        operation: async ({ prisma, params: { id }, data }) => {
            await assertNotPensioned(prisma, id)

            return prisma.interestGroup.update({
                where: { id },
                data,
            })
        },
    }),

    destroy: defineOperation({
        paramsSchema: z.object({
            id: z.number(),
        }),
        authorizer: () => interestGroupAuth.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params: { id } }) => {
            await assertNotPensioned(prisma, id)

            const memberIds = await prisma.$transaction(async tx => {
                const intrestGroup = await tx.interestGroup.delete({
                    where: { id }
                })
                return groupOperations.destroy.internalCall({
                    prisma: tx,
                    params: { groupId: intrestGroup.groupId },
                })
            })
            await invalidateManyUserSessionData(prisma, memberIds)
        }
    }),

    readSpecialCmsParagraphGeneralInfo: cmsParagraphOperations.readSpecial.implement({
        authorizer: () => interestGroupAuth.readSpecialCmsParagraphGeneralInfo,
        ownershipCheck: ({ params }) => params.special === 'INTEREST_GROUP_GENERAL_INFO'
    }),

    updateSpecialCmsParagraphContentGeneralInfo: cmsParagraphOperations.updateContent.implement({
        authorizer: () => interestGroupAuth.updateSpecialCmsParagraphContentGeneralInfo,
        ownershipCheck: async ({ params }) =>
            await cmsParagraphOperations.isSpecial.internalCall({
                params: {
                    paragraphId: params.paragraphId,
                    special: ['INTEREST_GROUP_GENERAL_INFO']
                }
            })
    }),
    updateArticleSection: implementUpdateArticleSectionOperations({
        implementationParamsSchema: z.object({
            interestGroupId: z.number()
        }),
        authorizer: async ({ implementationParams, prisma }) => {
            const { groupId } = await prisma.interestGroup.findUniqueOrThrow({
                where: { id: implementationParams.interestGroupId },
                select: { groupId: true }
            })
            return interestGroupAuth.updateArticleSection.data({ groupId })
        },
        beforeRun: ({ prisma, implementationParams }) =>
            assertNotPensioned(prisma, implementationParams.interestGroupId),
        ownedArticleSections: ({ prisma, implementationParams }) =>
            prisma.interestGroup.findUniqueOrThrow({
                where: { id: implementationParams.interestGroupId },
                include: {
                    articleSection: {
                        include: {
                            cmsImage: true,
                            cmsParagraph: true,
                            cmsLink: true
                        }
                    }
                }
            }).then(articleGroup => [articleGroup.articleSection]),
        destroyOnEmpty: false,
    }),
} as const
