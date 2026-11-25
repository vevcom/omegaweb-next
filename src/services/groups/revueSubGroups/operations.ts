import '@ow-server-only'
import { revueSubGroupAuth } from './auth'
import { revueSubGroupSchemas } from './schemas'
import { groupOperations } from '@/services/groups/operations'
import {
    implementGroupType,
    implementManualMigrationPerGroup,
    implementReorderMembersOperation,
    implementSimpleAddRemoveMembersOperation,
} from '@/services/groups/implementGroupType'
import { isGroupOfType } from '@/services/groups/groupChecks'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userOperations } from '@/services/users/operations'
import { defineOperation, defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { GroupType } from '@/prisma-generated-pn-types'

const commonGroupOperations = implementGroupType({
    type: GroupType.REVUE_SUB_GROUP,
    auth: {
        readExpanded: revueSubGroupAuth.readExpanded,
        readMembers: ({ groupId }) => revueSubGroupAuth.readMembers.data({ groupId }),
        readMembershipsOfUser: ({ userId }) => revueSubGroupAuth.readMembershipsOfUser.data({ userId }),
    },
})

const memberManagement = implementSimpleAddRemoveMembersOperation({
    type: GroupType.REVUE_SUB_GROUP,
    auth: {
        addMembers: ({ groupId }) => revueSubGroupAuth.addMembers.data({ groupId }),
        removeMembers: ({ groupId }) => revueSubGroupAuth.removeMembers.data({ groupId }),
        setMemberAdmin: ({ groupId }) => revueSubGroupAuth.setMemberAdmin.data({ groupId }),
        setMemberTitle: ({ groupId }) => revueSubGroupAuth.setMemberTitle.data({ groupId }),
        destroyMembership: ({ groupId }) => revueSubGroupAuth.destroyMembership.data({ groupId }),
    },
})

const memberOrdering = implementReorderMembersOperation({
    type: GroupType.REVUE_SUB_GROUP,
    auth: {
        reorderMembers: ({ groupId }) => revueSubGroupAuth.reorderMembers.data({ groupId }),
    },
})

const migration = implementManualMigrationPerGroup({
    type: GroupType.REVUE_SUB_GROUP,
    auth: {
        migrateGroup: () => revueSubGroupAuth.migrateGroup,
        pension: () => revueSubGroupAuth.pension,
    },
})

/**
 * The operations of the revue's own groups. A sub group is named by its revue group, so the revue
 * service makes and destroys one with its revue group, through `internal`, and nothing else does.
 */
export const revueSubGroupOperations = {
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    addMembers: memberManagement.addMembers,
    removeMembers: memberManagement.removeMembers,
    setMemberAdmin: memberManagement.setMemberAdmin,
    setMemberTitle: memberManagement.setMemberTitle,
    reorderMembers: memberOrdering.reorderMembers,
    destroyMembership: memberManagement.destroyMembership,
    migrateGroup: migration.migrateGroup,
    pension: migration.pension,

    /**
     * A page of those who can be added to a sub group: everyone who is not archived, since the revue
     * has members who have graduated or are not in Omega, whom the user list itself shows a user admin
     * alone.
     */
    readAddableUsers: defineOperation({
        paramsSchema: revueSubGroupSchemas.params.readAddableUsers,
        authorizer: ({ params }) => revueSubGroupAuth.readAddableUsers.data({ groupId: params.groupId }),
        operation: async ({ prisma, params }) => {
            if (!await isGroupOfType(prisma, params.groupId, GroupType.REVUE_SUB_GROUP)) {
                throw new ServiceError('NOT FOUND', 'Fant ikke revyundergruppen')
            }
            return userOperations.readPageOf.internalCall({
                prisma,
                params: { paging: params.paging },
                operationImplementationFields: { where: {} },
            })
        },
    }),

    internal: {
        create: defineSubOperation({
            operation: () => async ({ prisma }) => {
                const { order } = await omegaOrderOperations.readCurrent({ prisma, bypassAuth: true })
                return prisma.revueSubGroup.create({
                    data: { group: { create: { groupType: GroupType.REVUE_SUB_GROUP, order } } },
                })
            },
        }),

        destroy: defineSubOperation({
            paramsSchema: () => revueSubGroupSchemas.params.destroy,
            operation: () => async ({ prisma, params }) => {
                const revueSubGroup = await prisma.revueSubGroup.delete({ where: { id: params.id } })
                await groupOperations.destroy.internalCall({ prisma, params: { groupId: revueSubGroup.groupId } })
            },
        }),
    },
} as const
