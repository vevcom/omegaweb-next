import '@pn-server-only'
import { classAuth } from './auth'
import { classSchemas } from './schemas'
import { implementGroupType, implementStraightAwayMigration } from '@/services/groups/implementGroupType'
import { CLASS_LEVEL_ORDERING } from '@/services/groups/constants'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { defineOperation } from '@/services/serviceOperation'
import { invalidateManyUserSessionData, invalidateOneUserSessionData } from '@/services/auth/invalidateSession'
import logger from '@/lib/logger'
import { GroupType } from '@/prisma-generated-pn-types'
import type { ClassLevel } from '@/prisma-generated-pn-types'

/**
 * The level a user moves up into from the given one, or null when there is nowhere left to go -
 * GRADUATED is terminal.
 */
function nextClassLevel(level: ClassLevel): ClassLevel | null {
    const nextIndex = CLASS_LEVEL_ORDERING.indexOf(level) + 1
    return CLASS_LEVEL_ORDERING[nextIndex] ?? null
}

const commonGroupOperations = implementGroupType({
    type: GroupType.CLASS,
    auth: {
        readExpanded: classAuth.readExpanded,
        readMembers: () => classAuth.readMembers,
        readMembershipsOfUser: ({ userId }) => classAuth.readMembershipsOfUser.data({ userId }),
    },
})

const migration = implementStraightAwayMigration({
    type: GroupType.CLASS,
    auth: {
        migrateGroups: classAuth.migrateGroups,
    },
})

const readMany = defineOperation({
    authorizer: () => classAuth.readMany,
    operation: async ({ prisma }) => prisma.class.findMany()
})

const read = defineOperation({
    paramsSchema: classSchemas.read,
    authorizer: () => classAuth.read,
    operation: async ({ prisma, params }) => prisma.class.findUniqueOrThrow({
        where: params,
    })
})

/**
 * The class the user is in, or null when they have not been placed in one.
 *
 * A user holds one active class membership at a time - `changeClassOfUser` deactivates the ones they
 * held before, and `bumpClasses` deactivates the one it moves people out of. Holding several active
 * ones is therefore a broken state rather than something to represent: it is logged and resolved
 * here, so that everyone reading a user's class gets one answer instead of each caller inventing its
 * own tie-break.
 *
 * The most recent order wins, since that is the placement that was made last.
 */
const readClassOfUser = defineOperation({
    paramsSchema: classSchemas.readClassOfUser,
    authorizer: () => classAuth.readClassOfUser,
    operation: async ({ prisma, params }): Promise<{ level: ClassLevel, order: number } | null> => {
        const memberships = await prisma.membership.findMany({
            where: {
                userId: params.userId,
                active: true,
                group: { groupType: GroupType.CLASS },
            },
            select: {
                order: true,
                group: {
                    select: {
                        class: { select: { level: true } },
                    },
                },
            },
            orderBy: { order: 'desc' },
        })

        const classes = memberships.flatMap(membership => {
            const level = membership.group.class?.level
            return level ? [{ level, order: membership.order }] : []
        })

        if (classes.length === 0) return null

        if (classes.length > 1) {
            logger.warn('User holds several active class memberships', {
                userId: params.userId,
                classes: classes.map(userClass => `${userClass.level} (${userClass.order})`),
                resolvedTo: classes[0].level,
            })
        }

        return classes[0]
    }
})

/**
 * Puts the user in the given class, upholding both rules a user's classes follow:
 *
 * - one class membership per order, so a class the user was already registered in for this order is
 *   replaced rather than kept alongside - correcting an order says they were in this class, not that
 *   they moved between two;
 * - one active class membership, which is always the one of the highest order the user holds. The
 *   rest are kept, inactive: they are the record of which class the user was in back then, which is
 *   what the bump reads.
 *
 * Correcting an *earlier* order therefore leaves the new membership inactive, because a later one
 * exists - the user's class is still the later one.
 */
const changeClassOfUser = defineOperation({
    paramsSchema: classSchemas.changeClassOfUserParams,
    dataSchema: classSchemas.changeClassOfUser,
    authorizer: () => classAuth.changeClassOfUser,
    opensTransaction: true,
    operation: async ({ prisma, params, data }) => {
        const targetClass = await prisma.class.findUniqueOrThrow({
            where: { level: data.level },
            select: {
                groupId: true,
                group: { select: { order: true } },
            },
        })
        const order = params.order ?? targetClass.group.order

        const membership = await prisma.$transaction(async tx => {
            const classMembershipsOfUser = {
                userId: params.userId,
                group: { groupType: GroupType.CLASS },
            }

            // One per order: any other class the user is registered in for this order makes way.
            await tx.membership.deleteMany({
                where: {
                    ...classMembershipsOfUser,
                    order,
                    groupId: { not: targetClass.groupId },
                },
            })

            await tx.membership.upsert({
                where: {
                    userId_groupId_order: {
                        userId: params.userId,
                        groupId: targetClass.groupId,
                        order,
                    },
                },
                create: {
                    userId: params.userId,
                    groupId: targetClass.groupId,
                    order,
                    admin: false,
                    active: false,
                },
                update: {},
            })

            // One active, and it is the membership of the highest order - which is the one just
            // placed unless the user already had a later one.
            await tx.membership.updateMany({
                where: classMembershipsOfUser,
                data: { active: false },
            })
            const highest = await tx.membership.findFirstOrThrow({
                where: classMembershipsOfUser,
                orderBy: { order: 'desc' },
                select: { groupId: true, order: true },
            })
            await tx.membership.update({
                where: {
                    userId_groupId_order: {
                        userId: params.userId,
                        groupId: highest.groupId,
                        order: highest.order,
                    },
                },
                data: { active: true },
            })

            return tx.membership.findUniqueOrThrow({
                where: {
                    userId_groupId_order: {
                        userId: params.userId,
                        groupId: targetClass.groupId,
                        order,
                    },
                },
            })
        })

        await invalidateOneUserSessionData(prisma, params.userId)
        return membership
    }
})

/**
 * Moves everyone up one class.
 *
 * It takes every user who is not graduated and whose active class membership - the one of the
 * highest order they hold - is behind the current order, deactivates it and gives them a fresh
 * active membership of the current order in the class above. Nothing is deleted: the old membership
 * stays as the record of the class they were in that order.
 *
 * GRADUATED is terminal: those memberships are left exactly as they are, active, in the order they
 * were granted.
 *
 * A user who already holds a class membership of the current order - a new student registered
 * straight into their class, say - only has the old one deactivated, since one membership per order
 * leaves nothing to create for them.
 */
const bumpClasses = defineOperation({
    authorizer: () => classAuth.bumpClasses,
    opensTransaction: true,
    operation: async ({ prisma }) => {
        const { order: currentOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

        const classGroups = await prisma.class.findMany({
            select: { groupId: true, level: true },
        })
        const groupIdByLevel = new Map(classGroups.map(classGroup => [classGroup.level, classGroup.groupId]))

        const membershipsToBump = await prisma.membership.findMany({
            where: {
                active: true,
                order: { lt: currentOrder },
                group: {
                    groupType: GroupType.CLASS,
                    class: { level: { not: 'GRADUATED' } },
                },
            },
            select: {
                userId: true,
                admin: true,
                title: true,
                group: {
                    select: {
                        class: { select: { level: true } },
                    },
                },
            },
        })

        if (membershipsToBump.length === 0) return { bumped: 0, deactivated: 0 }

        const userIds = membershipsToBump.map(membership => membership.userId)

        // A user already registered in a class of the current order keeps that placement: they hold
        // one class membership per order, so there is no second one to create for them.
        const placedInCurrentOrder = await prisma.membership.findMany({
            where: {
                order: currentOrder,
                userId: { in: userIds },
                group: { groupType: GroupType.CLASS },
            },
            select: { userId: true },
        })
        const alreadyPlaced = new Set(placedInCurrentOrder.map(membership => membership.userId))

        const newMemberships = membershipsToBump.flatMap(membership => {
            const level = membership.group.class?.level
            if (!level || alreadyPlaced.has(membership.userId)) return []

            const nextLevel = nextClassLevel(level)
            const nextGroupId = nextLevel === null ? undefined : groupIdByLevel.get(nextLevel)
            if (nextGroupId === undefined) return []

            return [{
                userId: membership.userId,
                groupId: nextGroupId,
                order: currentOrder,
                active: true,
                admin: membership.admin,
                title: membership.title,
            }]
        })

        const { deactivated } = await prisma.$transaction(async tx => {
            const { count } = await tx.membership.updateMany({
                where: {
                    active: true,
                    order: { lt: currentOrder },
                    group: {
                        groupType: GroupType.CLASS,
                        class: { level: { not: 'GRADUATED' } },
                    },
                },
                data: { active: false },
            })

            await tx.membership.createMany({
                data: newMemberships,
                skipDuplicates: true,
            })

            return { deactivated: count }
        })

        await invalidateManyUserSessionData(prisma, userIds)

        return { bumped: newMemberships.length, deactivated }
    }
})

/**
 * Classes are neither created nor destroyed: there is exactly one class group per `ClassLevel`, and
 * the seeder upserts them. Users move between them through `changeClassOfUser` and `bumpClasses`.
 */
export const classOperations = {
    read,
    readMany,
    readExpanded: commonGroupOperations.readExpanded,
    readMembers: commonGroupOperations.readMembers,
    readMembershipsOfUser: commonGroupOperations.readMembershipsOfUser,
    readClassOfUser,
    changeClassOfUser,
    bumpClasses,
    migrateGroups: migration.migrateGroups,
} as const
