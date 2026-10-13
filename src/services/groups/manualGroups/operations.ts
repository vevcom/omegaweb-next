import '@pn-server-only'
import { manualGroupAuth } from './auth'
import { manualGroupSchemas } from './schemas'
import { assertGroupNotPensioned } from '@/services/groups/groupChecks'
import { groupOperations } from '@/services/groups/operations'
import {
    implementGroupType,
    implementManualMigrationPerGroup,
    implementSimpleAddRemoveMembersOperation,
} from '@/services/groups/implementGroupType'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { defineOperation } from '@/services/serviceOperation'
import { GroupType } from '@/prisma-generated-pn-types'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'

const commonGroupOperations = implementGroupType({
    type: GroupType.MANUAL_GROUP,
    auth: {
        readExpanded: manualGroupAuth.readExpanded,
        readMembers: ({ groupId }) => manualGroupAuth.readMembers.data({ groupId }),
        readMembershipsOfUser: ({ userId }) => manualGroupAuth.readMembershipsOfUser.data({ userId }),
    },
})

const memberManagement = implementSimpleAddRemoveMembersOperation({
    type: GroupType.MANUAL_GROUP,
    auth: {
        addMembers: ({ groupId }) => manualGroupAuth.addMembers.data({ groupId }),
        removeMembers: ({ groupId }) => manualGroupAuth.removeMembers.data({ groupId }),
        setMemberAdmin: ({ groupId }) => manualGroupAuth.setMemberAdmin.data({ groupId }),
        setMemberTitle: ({ groupId }) => manualGroupAuth.setMemberTitle.data({ groupId }),
    },
})

const migration = implementManualMigrationPerGroup({
    type: GroupType.MANUAL_GROUP,
    auth: {
        migrateGroup: ({ groupId }) => manualGroupAuth.migrateGroup.data({ groupId }),
        pension: () => manualGroupAuth.pension,
    },
    setPensioned: (prisma, groupId, pensioned) => prisma.manualGroup.update({
        where: { groupId },
        data: { pensioned },
    }),
})

const create = defineOperation({
    dataSchema: manualGroupSchemas.data.create,
    authorizer: () => manualGroupAuth.create,
    operation: async ({ prisma, data }) => {
        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

        return prisma.manualGroup.create({
            data: {
                ...data,
                group: {
                    create: {
                        groupType: GroupType.MANUAL_GROUP,
                        order,
                    }
                }
            },
        })
    }
})

const readMany = defineOperation({
    authorizer: () => manualGroupAuth.readMany,
    operation: async ({ prisma }) => prisma.manualGroup.findMany()
})

const read = defineOperation({
    paramsSchema: manualGroupSchemas.params.read,
    authorizer: () => manualGroupAuth.read,
    operation: async ({ prisma, params }) => prisma.manualGroup.findUniqueOrThrow({
        where: { id: params.id },
    })
})

/** The group behind a manual group, for the pensioned check. */

const update = defineOperation({
    paramsSchema: manualGroupSchemas.params.update,
    dataSchema: manualGroupSchemas.data.update,
    authorizer: () => manualGroupAuth.update,
    operation: async ({ prisma, params, data }) => {
        await assertGroupNotPensioned(prisma, await readGroupIdOfManualGroup(prisma, params.id))

        return prisma.manualGroup.update({
            where: { id: params.id },
            data,
        })
    }
})

const destroy = defineOperation({
    paramsSchema: manualGroupSchemas.params.destroy,
    authorizer: () => manualGroupAuth.destroy,
    opensTransaction: true,
    operation: async ({ prisma, params }) => {
        await assertGroupNotPensioned(prisma, await readGroupIdOfManualGroup(prisma, params.id))

        return prisma.$transaction(async tx => {
            const manualGroup = await tx.manualGroup.delete({
                where: { id: params.id },
            })
            await groupOperations.destroy.internalCall({
                prisma: tx,
                params: { groupId: manualGroup.groupId },
            })
            return manualGroup
        })
    }
})

export const manualGroupOperations = {
    create,
    read,
    readMany,
    update,
    destroy,
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    addMembers: memberManagement.addMembers,
    removeMembers: memberManagement.removeMembers,
    setMemberAdmin: memberManagement.setMemberAdmin,
    setMemberTitle: memberManagement.setMemberTitle,
    migrateGroup: migration.migrateGroup,
    pension: migration.pension,
} as const

async function readGroupIdOfManualGroup(prisma: PrismaPossibleTransaction<false>, id: number) {
    return (await prisma.manualGroup.findUniqueOrThrow({ where: { id }, select: { groupId: true } })).groupId
}
