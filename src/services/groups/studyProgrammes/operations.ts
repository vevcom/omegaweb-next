import '@pn-server-only'
import { studyProgrammeAuth } from './auth'
import { studyProgrammeSchemas } from './schemas'
import { groupOperations } from '@/services/groups/operations'
import { invalidateManyUserSessionData } from '@/services/auth/invalidateSession'
import {
    implementGroupType,
    implementSimpleAddRemoveMembersOperation,
    implementStraightAwayMigration,
} from '@/services/groups/implementGroupType'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { defineOperation } from '@/services/serviceOperation'
import { GroupType } from '@/prisma-generated-pn-types'
import { z } from 'zod'

const commonGroupOperations = implementGroupType({
    type: GroupType.STUDY_PROGRAMME,
    auth: {
        readExpanded: studyProgrammeAuth.readExpanded,
        readMembers: ({ groupId }) => studyProgrammeAuth.readMembers.data({ groupId }),
        readMembershipsOfUser: ({ userId }) => studyProgrammeAuth.readMembershipsOfUser.data({ userId }),
    },
})

/**
 * Study programme membership follows what Feide reports about a user - see
 * `updateUserStudyProgrammes` - rather than someone picking members by hand. These are therefore
 * deliberately NOT exposed as actions in `./actions`: nothing client-callable should be able to put
 * a user in a study programme.
 */
const memberManagement = implementSimpleAddRemoveMembersOperation({
    type: GroupType.STUDY_PROGRAMME,
    auth: {
        addMembers: ({ groupId }) => studyProgrammeAuth.addMembers.data({ groupId }),
        removeMembers: ({ groupId }) => studyProgrammeAuth.removeMembers.data({ groupId }),
        setMemberAdmin: ({ groupId }) => studyProgrammeAuth.setMemberAdmin.data({ groupId }),
        setMemberTitle: ({ groupId }) => studyProgrammeAuth.setMemberTitle.data({ groupId }),
    },
})

const migration = implementStraightAwayMigration({
    type: GroupType.STUDY_PROGRAMME,
    auth: {
        migrateGroups: studyProgrammeAuth.migrateGroups,
    },
})

const create = defineOperation({
    dataSchema: studyProgrammeSchemas.create,
    authorizer: () => studyProgrammeAuth.create,
    operation: async ({ prisma, data }) => {
        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

        return prisma.studyProgramme.create({
            data: {
                ...data,
                group: {
                    create: {
                        groupType: GroupType.STUDY_PROGRAMME,
                        order,
                    }
                }
            }
        })
    }
})

/**
 * Creates the study programmes (identified by code) that do not exist yet and returns all the given
 * ones as they are stored. Used when Feide tells us which programmes a user belongs to.
 */
const upsertMany = defineOperation({
    dataSchema: studyProgrammeSchemas.upsertMany,
    authorizer: () => studyProgrammeAuth.upsertMany,
    opensTransaction: true,
    operation: async ({ prisma, data }) => {
        if (data.studyProgrammes.length === 0) return []

        const existing = await prisma.studyProgramme.findMany({
            where: {
                code: {
                    in: data.studyProgrammes.map(studyProgramme => studyProgramme.code),
                },
            },
        })

        const existingCodes = new Set(existing.map(studyProgramme => studyProgramme.code))
        const missing = data.studyProgrammes.filter(
            studyProgramme => !existingCodes.has(studyProgramme.code)
        )

        if (missing.length === 0) return existing

        const { order } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

        const created = await prisma.$transaction(
            missing.map(studyProgramme => prisma.studyProgramme.create({
                data: {
                    ...studyProgramme,
                    group: {
                        create: {
                            groupType: GroupType.STUDY_PROGRAMME,
                            order,
                        },
                    },
                },
            }))
        )

        return existing.concat(created)
    }
})

const readMany = defineOperation({
    authorizer: () => studyProgrammeAuth.readMany,
    operation: async ({ prisma }) => prisma.studyProgramme.findMany()
})

const read = defineOperation({
    paramsSchema: z.object({
        id: z.number(),
    }),
    authorizer: () => studyProgrammeAuth.read,
    operation: async ({ prisma, params }) => prisma.studyProgramme.findUniqueOrThrow({
        where: { id: params.id },
    })
})

const update = defineOperation({
    paramsSchema: z.object({
        id: z.number(),
    }),
    dataSchema: studyProgrammeSchemas.update,
    authorizer: () => studyProgrammeAuth.update,
    operation: async ({ prisma, params, data }) => prisma.studyProgramme.update({
        where: { id: params.id },
        data,
    })
})

const destroy = defineOperation({
    paramsSchema: z.object({
        id: z.number(),
    }),
    authorizer: () => studyProgrammeAuth.destroy,
    opensTransaction: true,
    operation: async ({ prisma, params }) => {
        const { studyProgramme, memberIds } = await prisma.$transaction(async tx => {
            const deleted = await tx.studyProgramme.delete({
                where: { id: params.id },
            })
            const formerMemberIds = await groupOperations.destroy.internalCall({
                prisma: tx,
                params: { groupId: deleted.groupId },
            })
            return { studyProgramme: deleted, memberIds: formerMemberIds }
        })
        await invalidateManyUserSessionData(memberIds)
        return studyProgramme
    }
})

/**
 * The study programmes Feide has already reported for this user at some point.
 *
 * A programme is only added to a user the first time Feide mentions it. Without that record, a
 * membership someone removed by hand would be put straight back at the user's next login - Feide
 * keeps reporting the programme whether we act on it or not.
 */
const readFeideReturnedForUser = defineOperation({
    paramsSchema: z.object({
        userId: z.number(),
    }),
    authorizer: () => studyProgrammeAuth.readFeideReturnedForUser,
    operation: async ({ prisma, params }) => prisma.studyProgramme.findMany({
        where: {
            usersFeideHasAlreadyReturnedItFor: { some: { id: params.userId } },
        },
        select: { id: true },
    })
})

/**
 * Notes that Feide has now reported these programmes for the user, so that they are not acted on
 * again. Recording one that is already recorded changes nothing.
 */
const recordFeideReturnedForUser = defineOperation({
    paramsSchema: z.object({
        userId: z.number(),
    }),
    dataSchema: z.object({
        studyProgrammeIds: z.number().array(),
    }),
    authorizer: () => studyProgrammeAuth.recordFeideReturnedForUser,
    operation: async ({ prisma, params, data }) => prisma.user.update({
        where: { id: params.userId },
        data: {
            studyProgrammesFeideHasAlreadyReturned: {
                connect: data.studyProgrammeIds.map(id => ({ id })),
            },
        },
        select: { id: true },
    })
})

export const studyProgrammeOperations = {
    create,
    upsertMany,
    readFeideReturnedForUser,
    recordFeideReturnedForUser,
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
    migrateGroups: migration.migrateGroups,
} as const
