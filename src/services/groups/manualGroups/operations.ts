import '@pn-server-only'
import { manualGroupAuth } from './auth'
import { manualGroupSchemas } from './schemas'
import { groupOperations } from '@/services/groups/operations'
import { invalidateManyUserSessionData } from '@/services/auth/invalidateSession'
import {
    implementGroupType,
    implementManualMigrationPerGroup,
    implementSimpleAddRemoveMembersOperation,
} from '@/services/groups/implementGroupType'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { defineOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { GroupType } from '@/prisma-generated-pn-types'
import { z } from 'zod'
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
    dataSchema: manualGroupSchemas.create,
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
    paramsSchema: z.object({
        id: z.number(),
    }),
    authorizer: () => manualGroupAuth.read,
    operation: async ({ prisma, params }) => prisma.manualGroup.findUniqueOrThrow({
        where: { id: params.id },
    })
})

/**
 * A pensioned group is history: nothing about it may be changed until someone brings it back.
 */
async function assertNotPensioned(prisma: PrismaPossibleTransaction<false>, id: number) {
    const manualGroup = await prisma.manualGroup.findUniqueOrThrow({
        where: { id },
        select: { name: true, pensioned: true },
    })

    if (manualGroup.pensioned) {
        throw new ServiceError(
            'BAD PARAMETERS',
            `${manualGroup.name} er pensjonert og kan ikke endres. Gjenopprett gruppen først.`
        )
    }
}

const update = defineOperation({
    paramsSchema: z.object({
        id: z.number(),
    }),
    dataSchema: manualGroupSchemas.update,
    authorizer: () => manualGroupAuth.update,
    operation: async ({ prisma, params, data }) => {
        await assertNotPensioned(prisma, params.id)

        return prisma.manualGroup.update({
            where: { id: params.id },
            data,
        })
    }
})

const destroy = defineOperation({
    paramsSchema: z.object({
        id: z.number(),
    }),
    authorizer: () => manualGroupAuth.destroy,
    opensTransaction: true,
    operation: async ({ prisma, params }) => {
        await assertNotPensioned(prisma, params.id)

        const { manualGroup, memberIds } = await prisma.$transaction(async tx => {
            const deleted = await tx.manualGroup.delete({
                where: { id: params.id },
            })
            const formerMemberIds = await groupOperations.destroy.internalCall({
                prisma: tx,
                params: { groupId: deleted.groupId },
            })
            return { manualGroup: deleted, memberIds: formerMemberIds }
        })
        await invalidateManyUserSessionData(prisma, memberIds)
        return manualGroup
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
