import '@pn-server-only'
import { omegaMembershipGroupAuth } from './auth'
import { omegaMembershipGroupSchemas } from './schemas'
import { implementGroupType, implementStraightAwayMigration } from '@/services/groups/implementGroupType'
import { OMEGA_MEMBERSHIP_LEVEL_RANKING } from '@/services/groups/constants'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { admissionOperations } from '@/services/admission/operations'
import { allAdmissions } from '@/services/admission/constants'
import { defineOperation } from '@/services/serviceOperation'
import { invalidateOneUserSessionData } from '@/services/auth/invalidateSession'
import { ServiceError } from '@/services/error'
import logger from '@/lib/logger'
import { GroupType } from '@/prisma-generated-pn-types'
import type { OmegaMembershipLevel, Prisma } from '@/prisma-generated-pn-types'

function omegaMembershipGTEQ(lhs: OmegaMembershipLevel, rhs: OmegaMembershipLevel) {
    return OMEGA_MEMBERSHIP_LEVEL_RANKING.indexOf(lhs) >= OMEGA_MEMBERSHIP_LEVEL_RANKING.indexOf(rhs)
}

const commonGroupOperations = implementGroupType({
    type: GroupType.OMEGA_MEMBERSHIP_GROUP,
    auth: {
        readExpanded: omegaMembershipGroupAuth.readExpanded,
        readMembers: () => omegaMembershipGroupAuth.readMembers,
        readMembershipsOfUser: ({ userId }) => omegaMembershipGroupAuth.readMembershipsOfUser.data({ userId }),
    },
})

const migration = implementStraightAwayMigration({
    type: GroupType.OMEGA_MEMBERSHIP_GROUP,
    auth: {
        migrateGroups: omegaMembershipGroupAuth.migrateGroups,
    },
})

const readMany = defineOperation({
    authorizer: () => omegaMembershipGroupAuth.readMany,
    operation: async ({ prisma }) => prisma.omegaMembershipGroup.findMany()
})

const read = defineOperation({
    paramsSchema: omegaMembershipGroupSchemas.read,
    authorizer: () => omegaMembershipGroupAuth.read,
    operation: async ({ prisma, params }) => prisma.omegaMembershipGroup.findUniqueOrThrow({
        where: params,
    })
})

/**
 * The level a user's study programmes put them at: someone on a programme that is part of omega is
 * a soelle, and everyone else is part of den gemene hob. This is what places a user when they are
 * created and each time feide tells us what they study.
 *
 * It never reaches sysken, because that is earned by sitting the admission trials rather than by
 * what someone studies - which is why callers apply it with `onlyUpgrade`, so that a sysken is not
 * put back down to a soelle the next time they log in.
 *
 * Every study programme membership counts, including inactive ones and ones no one heard about
 * from feide: a programme an administrator granted by hand says as much about a user as one feide
 * returned.
 */
const inferUserLevel = defineOperation({
    paramsSchema: omegaMembershipGroupSchemas.inferUserLevel,
    authorizer: () => omegaMembershipGroupAuth.inferUserLevel,
    operation: async ({ prisma, params }): Promise<OmegaMembershipLevel> => {
        const partOfOmega = await prisma.membership.findFirst({
            where: {
                userId: params.userId,
                group: {
                    groupType: GroupType.STUDY_PROGRAMME,
                    studyProgramme: { partOfOmega: true },
                },
            },
            select: { groupId: true },
        })

        return partOfOmega ? 'SOELLE' : 'DEN_GEMENE_HOB'
    }
})

/**
 * The active omega memberships of a user, with the level each one is in. There should be exactly
 * one - `readUserLevel` is what decides what to do when there is not.
 */
async function readActiveOmegaMemberships(prisma: Prisma.TransactionClient, userId: number) {
    const memberships = await prisma.membership.findMany({
        where: {
            userId,
            active: true,
            group: { groupType: GroupType.OMEGA_MEMBERSHIP_GROUP },
        },
        select: {
            order: true,
            group: {
                select: {
                    omegaMembershipGroup: { select: { omegaMembershipLevel: true } },
                },
            },
        },
    })

    return memberships.flatMap(membership => {
        const level = membership.group.omegaMembershipGroup?.omegaMembershipLevel
        return level ? [{ level, order: membership.order }] : []
    })
}

/**
 * The writes that put a user into the omega membership group of the given level: the omega
 * membership they held goes inactive, and the admission trials are brought into the state the level
 * implies.
 *
 * A user holds at most one membership per omega membership group, and one of them is active. The
 * inactive ones are the record of the levels the user has been through - a sysken was a soelle
 * first - so a user put back at a level they held before gets that membership back, of the order
 * it was granted in, rather than a new one.
 *
 * The client to write with is handed in rather than opened here, so that a caller with more to
 * record in the same breath - the trial that earned the promotion - can pass its own transaction
 * and have the lot stand or fall together.
 *
 * Invalidating the user's session data is left to the caller, since that has to wait until the
 * transaction has committed - it writes to the user row on the global client, which the transaction
 * itself holds a lock on.
 */
export async function writeUserLevel(
    prisma: Prisma.TransactionClient,
    params: { userId: number, omegaMembershipLevel: OmegaMembershipLevel, onlyUpgrade: boolean },
) {
    const group = await read({
        params: { omegaMembershipLevel: params.omegaMembershipLevel },
        prisma,
        bypassAuth: true,
    })

    if (params.onlyUpgrade) {
        const current = await readActiveOmegaMemberships(prisma, params.userId)

        if (current.length === 1 && omegaMembershipGTEQ(current[0].level, params.omegaMembershipLevel)) {
            return
        }
    }

    const currentOmegaOrder = await omegaOrderOperations.readCurrent({ prisma, bypassAuth: true })

    const becomesSysken = omegaMembershipGTEQ(params.omegaMembershipLevel, 'SYSKEN')

    if (becomesSysken) {
        // Upserting by way of `skipDuplicates`, so a trial the user really did sit keeps
        // the date and the registrar it was sat with.
        await prisma.admissionTrial.createMany({
            data: allAdmissions.map(admission => ({
                userId: params.userId,
                admission,
            })),
            skipDuplicates: true,
        })
    } else {
        await prisma.admissionTrial.deleteMany({
            where: {
                userId: params.userId,
            }
        })
    }

    await prisma.membership.updateMany({
        where: {
            userId: params.userId,
            group: {
                groupType: GroupType.OMEGA_MEMBERSHIP_GROUP,
            },
        },
        data: { active: false },
    })

    const held = await prisma.membership.findFirst({
        where: {
            userId: params.userId,
            groupId: group.groupId,
        },
        orderBy: { order: 'desc' },
        select: { order: true },
    })

    if (held) {
        await prisma.membership.update({
            where: {
                userId_groupId_order: {
                    userId: params.userId,
                    groupId: group.groupId,
                    order: held.order,
                },
            },
            data: { active: true },
        })
        return
    }

    await prisma.membership.create({
        data: {
            active: true,
            user: {
                connect: { id: params.userId },
            },
            group: {
                connect: { id: group.groupId },
            },
            admin: false,
            omegaOrder: {
                connect: { order: currentOmegaOrder.order },
            },
        }
    })
}

/**
 * Moves the user into the omega membership group of the given level, leaving the one they held
 * inactive. This is the only way an omega membership changes on its own - the admission system
 * drives it, and `createTrial` makes the same move as part of recording the trial that earned it.
 */
const updateUserLevel = defineOperation({
    paramsSchema: omegaMembershipGroupSchemas.updateUserLevel,
    authorizer: () => omegaMembershipGroupAuth.updateUserLevel,
    opensTransaction: true,
    operation: async ({ prisma, params }) => {
        await prisma.$transaction(tx => writeUserLevel(tx, params))

        await invalidateOneUserSessionData(prisma, params.userId)
    }
})

/**
 * The omega membership the user holds - which of the omega membership groups they are an active
 * member of, and the order that membership was granted in.
 *
 * Every user is given one when they are created, and `updateUserLevel` deactivates the one they
 * hold when it grants another, so both holding no active one and holding several are broken states.
 * Neither is papered over at read time: the database is put right here, so that the next read - and
 * everything else that looks at the user's memberships - sees one answer rather than each caller
 * inventing its own tie-break.
 *
 * Which level to put the user at is the admission system's to say, since that is what the level
 * records: a user who has sat every trial has earned their place as a sysken, and anyone else is a
 * soelle. Den gemene hob is deliberately not a possible outcome - it is where users start out, so a
 * user whose membership has gone missing is assumed to have been somewhere in omega, not outside it.
 */
const readUserLevel = defineOperation({
    paramsSchema: omegaMembershipGroupSchemas.readUserLevel,
    authorizer: () => omegaMembershipGroupAuth.readUserLevel,
    operation: async ({ prisma, params }): Promise<{ level: OmegaMembershipLevel, order: number }> => {
        const omegaMemberships = await readActiveOmegaMemberships(prisma, params.userId)

        if (omegaMemberships.length === 1) return omegaMemberships[0]

        const completedTrials = await admissionOperations.userCompletedTrials({
            params: { userId: params.userId },
            bypassAuth: true,
        })
        const level = completedTrials ? 'SYSKEN' : 'SOELLE'

        logger.warn('User holds a broken omega membership - rewriting it', {
            userId: params.userId,
            held: omegaMemberships.map(
                omegaMembership => `${omegaMembership.level} (${omegaMembership.order})`
            ),
            completedTrials,
            rewrittenTo: level,
        })

        await updateUserLevel({
            params: {
                userId: params.userId,
                omegaMembershipLevel: level,
                onlyUpgrade: false,
            },
            bypassAuth: true,
        })

        const [rewritten] = await readActiveOmegaMemberships(prisma, params.userId)
        return rewritten
    }
})

/**
 * Moves the user's omega membership to the given order, leaving the level it is in alone.
 *
 * The order records when the membership was granted - which order someone was taken up in - and is
 * what the profile reads back as "udaf den n'dis orden". It is set to the order that was current at
 * the time, so correcting it is the only way to fix a membership that was granted late, or one
 * carried over from omegaweb basic with the wrong year against it.
 */
const updateUserOrder = defineOperation({
    paramsSchema: omegaMembershipGroupSchemas.updateUserOrderParams,
    dataSchema: omegaMembershipGroupSchemas.updateUserOrder,
    authorizer: () => omegaMembershipGroupAuth.updateUserOrder,
    opensTransaction: true,
    operation: async ({ prisma, params, data }) => {
        // Read before the transaction is opened: a user whose memberships are in a broken state is
        // put right first, and that writes.
        const current = await readUserLevel({
            params: { userId: params.userId },
            bypassAuth: true,
        })
        if (current.order === data.order) return

        const [group, order] = await Promise.all([
            read({
                params: { omegaMembershipLevel: current.level },
                bypassAuth: true,
            }),
            prisma.omegaOrder.findUnique({ where: { order: data.order } }),
        ])

        if (!order) {
            throw new ServiceError('BAD DATA', `Den ${data.order}'dis orden finnes ikke.`)
        }

        await prisma.$transaction([
            // The membership is unique on user, group and order, so anything already sitting where
            // this one is moving to is the same membership recorded twice and makes way for it.
            prisma.membership.deleteMany({
                where: {
                    userId: params.userId,
                    groupId: group.groupId,
                    order: data.order,
                },
            }),
            prisma.membership.update({
                where: {
                    userId_groupId_order: {
                        userId: params.userId,
                        groupId: group.groupId,
                        order: current.order,
                    },
                },
                data: { order: data.order },
            }),
        ])

        // The memberships a session carries hold the order they are of.
        await invalidateOneUserSessionData(prisma, params.userId)
    }
})

/**
 * Omega membership groups are neither created nor destroyed: there is one per `OmegaMembershipLevel`
 * and they always have to exist.
 */
export const omegaMembershipGroupOperations = {
    read,
    readMany,
    readUserLevel,
    inferUserLevel,
    updateUserLevel,
    updateUserOrder,
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    migrateGroups: migration.migrateGroups,
} as const
