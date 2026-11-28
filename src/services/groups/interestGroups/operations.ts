import '@ow-server-only'
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
import { implementSpecialCmsParagraphs } from '@/cms/paragraphs/implement'
import { implementArticleSectionOperations } from '@/cms/articleSections/implement'
import { assertGroupNotPensioned } from '@/services/groups/groupChecks'
import { implementSearchOperation } from '@/services/search/implement'
import { omegaLinks } from '@/app/(omegaweb)/links'
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
        destroyMembership: ({ groupId }) => interestGroupAuth.destroyMembership.data({ groupId }),
    },
})

const migration = implementManualMigrationPerGroup({
    type: GroupType.INTEREST_GROUP,
    auth: {
        migrateGroup: ({ groupId }) => interestGroupAuth.migrateGroup.data({ groupId }),
        pension: () => interestGroupAuth.pension,
    },
})

/** The group behind an interest group, for the authorizers and the pensioned check. */
const articleSection = implementArticleSectionOperations({
    implementationParamsSchema: interestGroupSchemas.params.articleSection,
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
        }).then(interestGroup => [interestGroup.articleSection]),
})

export const interestGroupOperations = {
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    addMembers: memberManagement.addMembers,
    removeMembers: memberManagement.removeMembers,
    setMemberAdmin: memberManagement.setMemberAdmin,
    setMemberTitle: memberManagement.setMemberTitle,
    destroyMembership: memberManagement.destroyMembership,
    migrateGroup: migration.migrateGroup,
    pension: migration.pension,
    create: defineOperation({
        dataSchema: interestGroupSchemas.data.create,
        authorizer: () => interestGroupAuth.create,
        transaction: 'RUNS_IN',
        read: false,
        operation: async ({ prisma, data }) => {
            const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            const createdSection = await articleSection.internal.create.internalCall({ data: {}, prisma })
            return await prisma.interestGroup.create({
                data: {
                    ...data,
                    articleSection: {
                        connect: { id: createdSection.id },
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
        read: true,
        operation: ({ prisma }) => prisma.interestGroup.findMany({
            include: {
                articleSection: {
                    include: articleSectionsRelationsIncluder,
                },
                group: { select: { pensioned: true } },
            },
            orderBy: [
                { name: 'asc' },
                { id: 'asc' },
            ]
        })
    }),

    search: implementSearchOperation({
        authorizer: () => interestGroupAuth.search,
        find: ({ prisma, query, take }) => prisma.interestGroup.findMany({
            take,
            where: { name: { contains: query, mode: 'insensitive' } },
            select: {
                id: true,
                name: true,
                group: { select: { pensioned: true } },
            },
            orderBy: [{ group: { pensioned: 'asc' } }, { name: 'asc' }],
        }),
        toSearchResult: interestGroup => ({
            key: `interest-group-${interestGroup.id}`,
            href: omegaLinks.interestGroup(interestGroup),
            label: interestGroup.name,
            sublabel: interestGroup.group.pensioned ? 'Pensjonert' : undefined,
            image: null,
        }),
    }),

    read: defineOperation({
        paramsSchema: interestGroupSchemas.params.read,
        authorizer: () => interestGroupAuth.read,
        read: true,
        operation: async ({ prisma, params: { id } }) => await prisma.interestGroup.findUniqueOrThrow({
            where: {
                id,
            },
            include: {
                articleSection: {
                    include: articleSectionsRelationsIncluder,
                },
                group: { select: { pensioned: true } },
            }
        })
    }),

    update: defineOperation({
        paramsSchema: interestGroupSchemas.params.update,
        dataSchema: interestGroupSchemas.data.update,
        authorizer: async ({ prisma, params }) => interestGroupAuth.update.data({
            groupId: await readGroupIdOfInterestGroup(prisma, params.id),
        }),
        read: false,
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
        transaction: 'RUNS_IN',
        read: false,
        operation: async ({ prisma, params: { id } }) => {
            await assertGroupNotPensioned(prisma, await readGroupIdOfInterestGroup(prisma, id))

            const interestGroup = await prisma.interestGroup.delete({
                where: { id }
            })
            // The section's image, paragraph and link go with it.
            await articleSection.internal.destroy.internalCall({
                prisma,
                params: { articleSectionId: interestGroup.articleSectionId },
            })
            await groupOperations.destroy.internalCall({
                prisma,
                params: { groupId: interestGroup.groupId },
            })
        }
    }),

    generalInfo: implementSpecialCmsParagraphs({
        specials: ['INTEREST_GROUP_GENERAL_INFO'],
        authorizers: interestGroupAuth.generalInfo,
    }),

    articleSection,
} as const

async function readGroupIdOfInterestGroup(prisma: PrismaPossibleTransaction<false>, id: number) {
    return (await prisma.interestGroup.findUniqueOrThrow({ where: { id }, select: { groupId: true } })).groupId
}
