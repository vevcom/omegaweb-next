import '@pn-server-only'
import { interestGroupAuth } from './auth'
import { interestGroupSchemas } from './schemas'
import { groupOperations } from '@/services/groups/operations'
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
import { assertGroupNotPensioned } from '@/services/groups/groupChecks'
import { articleSectionOperations } from '@/cms/articleSections/operations'
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

/** The group behind an interest group, for the authorizers and the pensioned check. */
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
        dataSchema: interestGroupSchemas.data.create,
        authorizer: () => interestGroupAuth.create,
        opensTransaction: true,
        operation: async ({ prisma, data }) => {
            const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            return await prisma.$transaction(async tx => {
                const articleSection = await articleSectionOperations.create.internalCall({ data: {}, prisma: tx })
                return await tx.interestGroup.create({
                    data: {
                        ...data,
                        articleSection: {
                            connect: { id: articleSection.id },
                        },
                        group: {
                            create: {
                                groupType: 'INTEREST_GROUP',
                                order,
                            }
                        }
                    }
                })
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
        paramsSchema: interestGroupSchemas.params.read,
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
        paramsSchema: interestGroupSchemas.params.update,
        dataSchema: interestGroupSchemas.data.update,
        authorizer: async ({ prisma, params }) => interestGroupAuth.update.data({
            groupId: await readGroupIdOfInterestGroup(prisma, params.id),
        }),
        operation: async ({ prisma, params: { id }, data }) => {
            await assertGroupNotPensioned(prisma, await readGroupIdOfInterestGroup(prisma, id))

            return prisma.interestGroup.update({
                where: { id },
                data,
            })
        },
    }),

    destroy: defineOperation({
        paramsSchema: interestGroupSchemas.params.destroy,
        authorizer: () => interestGroupAuth.destroy,
        opensTransaction: true,
        operation: async ({ prisma, params: { id } }) => {
            await assertGroupNotPensioned(prisma, await readGroupIdOfInterestGroup(prisma, id))

            await prisma.$transaction(async tx => {
                const interestGroup = await tx.interestGroup.delete({
                    where: { id }
                })
                // The section's image, paragraph and link go with it.
                await articleSectionOperations.destroy.internalCall({
                    prisma: tx,
                    params: { articleSectionId: interestGroup.articleSectionId },
                })
                await groupOperations.destroy.internalCall({
                    prisma: tx,
                    params: { groupId: interestGroup.groupId },
                })
            })
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
        implementationParamsSchema: interestGroupSchemas.params.updateArticleSection,
        authorizer: async ({ implementationParams, prisma }) => interestGroupAuth.updateArticleSection.data({
            groupId: await readGroupIdOfInterestGroup(prisma, implementationParams.interestGroupId),
        }),
        beforeRun: async ({ prisma, implementationParams }) => assertGroupNotPensioned(
            prisma,
            await readGroupIdOfInterestGroup(prisma, implementationParams.interestGroupId),
        ),
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

async function readGroupIdOfInterestGroup(prisma: PrismaPossibleTransaction<false>, id: number) {
    return (await prisma.interestGroup.findUniqueOrThrow({ where: { id }, select: { groupId: true } })).groupId
}
