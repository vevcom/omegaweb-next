import '@pn-server-only'
import { assertGroupValidity } from './assertGroupValidity'
import { isGroupPensioned } from './groupChecks'
import { groupSchemas } from './schemas'
import {
    groupMembershipIncluder,
    groupsExpandedIncluder,
    groupsWithRelationsIncluder,
    membershipFilterSelection,
    readGroupsOfUserIncluder,
} from './constants'
import { omegaOrderOperations } from '@/services/omegaOrder/operations'
import { userPartitions } from '@/services/users/constants'
import { MigratedStraightAwayOnIncrement } from '@/services/omegaOrder/constants'
import { standardImageCollectionOperations } from '@/services/images/standard/operations'
import { defineSubOperation } from '@/services/serviceOperation'
import { ServiceError } from '@/services/error'
import { getMembershipFilter } from '@/auth/getMembershipFilter'
import { invalidateManyUserSessionData, invalidateOneUserSessionData } from '@/services/auth/invalidateSession'
import { inferGroupName } from '@/lib/groups/inferGroupName'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { GroupType } from '@/prisma-generated-pn-types'
import type {
    ExpandedGroup,
    GroupWithRelationsNameInferencer,
    MembershipFiltered,
} from './types'
import type { UserBasic } from '@/services/users/types'

/**
 * The group operations shared by every group type, plus the few group reads that are inherently
 * cross-type (building a session, resolving the groups behind a locker reservation).
 *
 * The common ones are deliberately unauthorized sub-operations: a group is only ever reachable
 * through its own group type's service, which implements the ones it wants through the `implement*`
 * factories in `./implementGroupType` - supplying its own authorizers and getting the group-type
 * ownership check for free.
 */
export const groupOperations = {
    readExpandedOfType: defineSubOperation({
        operation: ({ type }: { type: GroupType }) => async ({ prisma }): Promise<ExpandedGroup[]> => {
            const groups = await prisma.group.findMany({
                where: { groupType: type },
                include: groupsExpandedIncluder,
            })

            return groups.map(({ _count, ...group }) => expandGroup({ ...assertGroupValidity(group), _count }))
        }
    }),

    /**
     * Every membership the user has held in groups of the implementing type, active or not, newest
     * order first - each with its group's display name, since that is what someone reading them is after.
     */
    readMembershipsOfUserOfType: defineSubOperation({
        paramsSchema: () => groupSchemas.params.readMembershipsOfUserOfType,
        operation: ({ type }: { type: GroupType }) => async ({ prisma, params }) => {
            const memberships = await prisma.membership.findMany({
                where: {
                    userId: params.userId,
                    group: { groupType: type },
                },
                select: {
                    ...membershipFilterSelection,
                    title: true,
                    group: { include: groupsWithRelationsIncluder },
                },
                orderBy: { order: 'desc' },
            })

            return memberships.map(({ group, ...membership }) => ({
                ...membership,
                groupName: inferGroupName(assertGroupValidity(group)),
            }))
        }
    }),

    readMembers: defineSubOperation({
        paramsSchema: () => groupSchemas.params.readMembers,
        operation: () => async ({ prisma, params }) => {
            const defaultProfileImage = await standardImageCollectionOperations.readStandardImage({
                params: { standardImage: 'DEFAULT_PROFILE_IMAGE' },
            })

            const memberships = await prisma.membership.findMany({
                where: {
                    groupId: params.groupId,
                    active: params.active,
                    user: userPartitions.unarchived,
                },
                include: groupMembershipIncluder,
            })

            return memberships.map(membership => ({
                ...membership,
                user: {
                    ...membership.user,
                    image: membership.user.image ?? defaultProfileImage,
                },
            }))
        }
    }),

    /**
     * Adds members to the group at the given order, or at the group's current order when none is
     * given. A membership that already exists at that order is reactivated rather than duplicated.
     *
     * A group that is migrated by hand never holds active memberships below its own order, so a
     * membership added to an earlier order of one is history: it is created inactive, and an
     * existing membership there is left as it is rather than reactivated. The group types that
     * follow omega's order have no such rule - a user keeps the active membership of the order they
     * got it in - so for those the order makes no difference.
     */
    addMembers: defineSubOperation({
        paramsSchema: () => groupSchemas.params.addMembers,
        dataSchema: () => groupSchemas.data.addMembers,
        // Its writes and the session invalidation have to land together.
        opensTransaction: true,
        operation: () => async ({ prisma, params, data }) => await prisma.$transaction(async tx => {
            const group = await readGroupOrderAndType(tx, params.groupId)
            const order = resolveMembershipOrder(group, params.order)
            const userIds = data.users.map(user => user.userId)

            const active = order === group.order ||
                MigratedStraightAwayOnIncrement[group.groupType]

            if (active) {
                await Promise.all([true, false].map(admin => tx.membership.updateMany({
                    where: {
                        groupId: params.groupId,
                        userId: { in: data.users.filter(user => user.admin === admin).map(user => user.userId) },
                        order,
                    },
                    data: { active: true, admin },
                })))
            }

            await tx.membership.createMany({
                data: data.users.map(({ userId, admin }) => ({
                    groupId: params.groupId,
                    userId,
                    admin,
                    order,
                    active,
                })),
                skipDuplicates: true,
            })

            await invalidateManyUserSessionData(tx, userIds)
        }),
    }),

    /**
     * Deactivates the members' memberships of the given order, or of the group's current order when
     * none is given. The memberships are kept rather than deleted, so that the group's history of
     * the order stays intact.
     */
    removeMembers: defineSubOperation({
        paramsSchema: () => groupSchemas.params.removeMembers,
        dataSchema: () => groupSchemas.data.removeMembers,
        // Its writes and the session invalidation have to land together.
        opensTransaction: true,
        operation: () => async ({ prisma, params, data }) => await prisma.$transaction(async tx => {
            const group = await readGroupOrderAndType(tx, params.groupId)
            const order = resolveMembershipOrder(group, params.order)

            await tx.membership.updateMany({
                where: {
                    groupId: params.groupId,
                    userId: { in: data.userIds },
                    order,
                },
                data: { active: false },
            })

            await invalidateManyUserSessionData(tx, data.userIds)
        }),
    }),

    /**
     * Makes a member an admin of the group, or takes it away, for the given order or the group's
     * current one.
     *
     * A group admin may administer the group itself - see `RequirePermissionOrGroupAdmin` - so the
     * user's session has to be invalidated for the change to take effect.
     */
    setMemberAdmin: defineSubOperation({
        paramsSchema: () => groupSchemas.params.setMemberAdmin,
        dataSchema: () => groupSchemas.data.setMemberAdmin,
        // Its writes and the session invalidation have to land together.
        opensTransaction: true,
        operation: () => async ({ prisma, params, data }) => await prisma.$transaction(async tx => {
            const group = await readGroupOrderAndType(tx, params.groupId)
            const order = resolveMembershipOrder(group, params.order)

            const membership = await tx.membership.update({
                where: {
                    userId_groupId_order: {
                        groupId: params.groupId,
                        userId: data.userId,
                        order,
                    },
                },
                data: { admin: data.admin },
            })

            await invalidateOneUserSessionData(tx, data.userId)
            return membership
        }),
    }),

    /**
     * Sets a member's title within the group - "Leder", "Kasserer" and so on - for the given order
     * or the group's current one.
     *
     * Unlike the admin flag the title is not part of the session (see `membershipFieldsToExpose`),
     * so no session has to be invalidated for it.
     */
    setMemberTitle: defineSubOperation({
        paramsSchema: () => groupSchemas.params.setMemberTitle,
        dataSchema: () => groupSchemas.data.setMemberTitle,
        operation: () => async ({ prisma, params, data }) => {
            const group = await readGroupOrderAndType(prisma, params.groupId)
            const order = resolveMembershipOrder(group, params.order)

            return prisma.membership.update({
                where: {
                    userId_groupId_order: {
                        groupId: params.groupId,
                        userId: data.userId,
                        order,
                    },
                },
                data: { title: data.title },
            })
        }
    }),

    /**
     * Retires a group instead of migrating it, or brings a retired one back.
     *
     * Pensioning ends the group: every active membership is deactivated, and the group stops counting
     * towards the requirements for incrementing omega - it is no longer something anyone is waiting
     * to migrate.
     *
     * Bringing one back puts it straight into the current order. There is nothing to migrate through
     * - it has no active memberships - and leaving it behind would block the next increment.
     *
     * Only the group types that are migrated by hand implement it, so only those can be pensioned.
     */
    pension: defineSubOperation({
        opensTransaction: true,
        paramsSchema: () => groupSchemas.params.pension,
        dataSchema: () => groupSchemas.data.pension,
        operation: () => async ({ prisma, params, data }) => {
            const { order: currentOmegaOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            if (!data.pensioned && !await isGroupPensioned(prisma, params.groupId)) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Gruppen er ikke pensjonert og kan ikke gjenopprettes.'
                )
            }

            await prisma.$transaction(async tx => {
                await tx.group.update({
                    where: { id: params.groupId },
                    data: { pensioned: data.pensioned },
                })

                if (data.pensioned) {
                    const endedMemberships = await tx.membership.findMany({
                        where: { groupId: params.groupId, active: true },
                        select: { userId: true },
                    })
                    await tx.membership.updateMany({
                        where: { groupId: params.groupId, active: true },
                        data: { active: false },
                    })
                    await invalidateManyUserSessionData(tx, endedMemberships.map(membership => membership.userId))
                    return
                }

                await tx.group.update({
                    where: { id: params.groupId },
                    data: { order: currentOmegaOrder },
                })
            })
        }
    }),

    /**
     * Migrates one group that is behind the current omega order up to it, keeping the selected
     * users. Every membership of the group's old order is deactivated; the kept users additionally
     * get a fresh active membership of the new order, with the admin flag chosen for them and their
     * title carried over.
     *
     * Someone has to administer the group in the new order, so at least one of the kept members must
     * be an admin. The one exception is a group whose old order had no active members at all: there
     * is nobody to promote, so the rule cannot be met and is not applied.
     *
     * After this the group holds no active memberships below its own order.
     */
    migrateGroup: defineSubOperation({
        opensTransaction: true,
        paramsSchema: () => groupSchemas.params.migrateGroup,
        dataSchema: () => groupSchemas.data.migrateGroup,
        operation: () => async ({ prisma, params, data }) => {
            const { order: currentOmegaOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })
            const { order: groupOrder } = await readGroupOrderAndType(prisma, params.groupId)

            if (groupOrder >= currentOmegaOrder) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Gruppen er allerede migrert til nåværende orden'
                )
            }

            const membershipsOfOldOrder = await prisma.membership.findMany({
                where: {
                    groupId: params.groupId,
                    order: groupOrder,
                    active: true,
                },
                select: {
                    userId: true,
                    admin: true,
                    title: true,
                },
            })

            const activeUserIds = membershipsOfOldOrder.map(membership => membership.userId)
            const adminOfKeptUser = new Map(data.keep.map(kept => [kept.userId, kept.admin]))

            const notActiveMembers = data.keep
                .map(kept => kept.userId)
                .filter(userId => !activeUserIds.includes(userId))
            if (notActiveMembers.length) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    `Kan ikke beholde brukere som ikke er aktive medlemmer av gruppen: ${notActiveMembers.join(', ')}`
                )
            }

            if (activeUserIds.length && !data.keep.some(kept => kept.admin)) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    `Minst ett medlem må være admin i orden ${currentOmegaOrder}`
                )
            }

            const keptMemberships = membershipsOfOldOrder.filter(
                membership => adminOfKeptUser.has(membership.userId)
            )

            await prisma.$transaction(async tx => {
                await tx.membership.updateMany({
                    where: {
                        groupId: params.groupId,
                        order: groupOrder,
                        active: true,
                    },
                    data: { active: false },
                })

                await tx.membership.createMany({
                    data: keptMemberships.map(membership => ({
                        groupId: params.groupId,
                        userId: membership.userId,
                        admin: adminOfKeptUser.get(membership.userId) ?? false,
                        title: membership.title,
                        order: currentOmegaOrder,
                        active: true,
                    })),
                    skipDuplicates: true,
                })

                await tx.group.update({
                    where: { id: params.groupId },
                    data: { order: currentOmegaOrder },
                })

                await invalidateManyUserSessionData(tx, activeUserIds)
            })
        }
    }),

    /**
     * Brings every group of the type up to the current omega order at once. Memberships are left
     * alone: a user keeps the active membership of the order they got it in, and gets no membership
     * of the new order from this.
     */
    migrateStraightAwayOfType: defineSubOperation({
        operation: ({ type }: { type: GroupType }) => async ({ prisma }) => {
            const { order: currentOmegaOrder } = await omegaOrderOperations.readCurrent({ bypassAuth: true })

            // No pensioning to account for here: only the group types migrated by hand can be
            // retired, and these follow omega whether anyone is in them or not.
            const { count } = await prisma.group.updateMany({
                where: {
                    groupType: type,
                    order: { lt: currentOmegaOrder },
                },
                data: { order: currentOmegaOrder },
            })

            return { migratedGroups: count }
        }
    }),

    /**
     * The memberships of one user across every group type, filtered by order:
     * - a number: only memberships of that order
     * - 'ACTIVE': only active memberships
     * - 'ALL' or left out: every membership
     *
     * Cross-type on purpose - it builds the session, which has to know every group the user is in
     * regardless of type. It is a sub-operation because the session cannot yet be authorized
     * against at the point it is read.
     */
    readMembershipsOfUserOfAllTypes: defineSubOperation({
        paramsSchema: () => groupSchemas.params.readMembershipsOfUserOfAllTypes,
        operation: () => async ({ prisma, params }): Promise<MembershipFiltered[]> => prisma.membership.findMany({
            where: {
                userId: params.userId,
                ...(params.order ? getMembershipFilter(params.order) : {}),
            },
            select: membershipFilterSelection,
        })
    }),

    /**
     * Cross-type: resolves the users behind a set of groups, used to work out who a locker
     * reservation covers. Only active memberships count: a former member is not behind the group.
     */
    readUsersOfGroups: defineSubOperation({
        paramsSchema: () => groupSchemas.params.readUsersOfGroups,
        operation: () => async ({ prisma, params }): Promise<Pick<UserBasic, 'id'>[]> => {
            const memberships = await prisma.membership.findMany({
                where: {
                    active: true,
                    user: userPartitions.unarchived,
                    OR: params.groups.map(({ admin, groupId }) => ({
                        admin: admin !== true ? undefined : true,
                        groupId,
                    })),
                },
                select: {
                    user: {
                        select: { id: true },
                    }
                }
            })

            return memberships.map(({ user }) => user)
        }
    }),

    /**
     * Cross-type: every group the user is a member of, with its type relation resolved.
     */
    readGroupsOfUser: defineSubOperation({
        paramsSchema: () => groupSchemas.params.readGroupsOfUser,
        operation: () => async ({ prisma, params }) => {
            const memberships = await prisma.membership.findMany({
                where: {
                    userId: params.userId,
                },
                include: {
                    group: {
                        include: readGroupsOfUserIncluder,
                    },
                },
            })

            return memberships.map(membership => assertGroupValidity(membership.group))
        },
    }),

    /**
     * Deletes a group whose group type row has just been deleted in the same transaction. Its
     * memberships and permissions go with it, so the users it returns - everyone who held a
     * membership - carry permissions in their sessions that no longer exist. The caller invalidates
     * those sessions once the transaction has committed.
     */
    destroy: defineSubOperation({
        paramsSchema: () => groupSchemas.params.destroy,
        operation: () => async ({ prisma, params }) => {
            const memberships = await prisma.membership.findMany({
                where: { groupId: params.groupId },
                select: { userId: true },
                distinct: ['userId'],
            })
            await prisma.group.delete({ where: { id: params.groupId } })
            await invalidateManyUserSessionData(prisma, memberships.map(membership => membership.userId))
        },
    }),
} as const

/**
 * A group as the lists show it: how many active members it has, the first order it had members in
 * (its own order if it never had any), and its display name. `groupsExpandedIncluder` reads the
 * first membership and the count with the group, so this does no queries of its own.
 */
function expandGroup(
    { _count, ...group }: GroupWithRelationsNameInferencer & {
        memberships: { order: number }[],
        _count: { memberships: number },
    },
): ExpandedGroup {
    return {
        ...group,
        members: _count.memberships,
        firstOrder: group.memberships[0]?.order ?? group.order,
        name: inferGroupName(group),
    }
}

type GroupOrderAndType = {
    order: number,
    groupType: GroupType,
}

async function readGroupOrderAndType(
    prisma: PrismaPossibleTransaction<false>,
    groupId: number,
): Promise<GroupOrderAndType> {
    return prisma.group.findUniqueOrThrow({
        where: { id: groupId },
        select: { order: true, groupType: true },
    })
}

/**
 * The order the member management operations act on: the one asked for, or the group's own current
 * order when none is. A group cannot hold memberships of an order it has not reached itself, so an
 * order above the group's own is refused.
 */
function resolveMembershipOrder(group: GroupOrderAndType, order?: number): number {
    if (order === undefined) return group.order

    if (order > group.order) {
        throw new ServiceError(
            'BAD PARAMETERS',
            `Gruppen står i orden ${group.order} og kan ikke ha medlemskap i orden ${order}`
        )
    }

    return order
}
