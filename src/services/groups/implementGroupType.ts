import '@pn-server-only'
import { assertGroupNotPensioned, groupOperations, isGroupOfType } from './operations'
import type { Authorizer } from '@/auth/authorizer/Authorizer'
import type { PrismaPossibleTransaction } from '@/services/serviceOperation'
import type { GroupType } from '@/prisma-generated-pn-types'
import type { SetPensioned } from './types'

/**
 * An authorizer for an operation that addresses one particular group. The group type's own auth
 * decides what it needs the groupId for - typically binding `RequirePermissionOrGroupAdmin` so that
 * the group's own admins are allowed through.
 */
export type GroupAuthorizerOfGroup = (args: { groupId: number }) =>
    | Authorizer
    | Promise<Authorizer>

/**
 * The ownership check shared by every common operation addressing a single group: the group must be
 * of the implementing type. Without it a group type's operations would reach every group in the
 * system, which is exactly what the split into per-type services is meant to prevent.
 */
function ownershipCheckOfType(type: GroupType) {
    return ({ prisma, params }: {
        prisma: PrismaPossibleTransaction<false>,
        params: { groupId: number },
    }) => isGroupOfType(prisma, params.groupId, type)
}

/**
 * The common operations every group type implements. A group type calls this from its own
 * `operations.ts`, supplies its own authorizers, and spreads the result into its operations object.
 */
export function implementGroupType({ type, auth }: {
    type: GroupType,
    auth: {
        readExpanded: Authorizer,
        readMembers: GroupAuthorizerOfGroup,
        readMembershipsOfUser: (args: { userId: number }) => Authorizer,
    },
}) {
    return {
        readExpanded: groupOperations.readExpandedOfType.implement({
            authorizer: () => auth.readExpanded,
            ownershipCheck: () => true,
            operationImplementationFields: { type },
        }),
        readMembershipsOfUser: groupOperations.readMembershipsOfUserOfType.implement({
            authorizer: ({ params }) => auth.readMembershipsOfUser({ userId: params.userId }),
            ownershipCheck: () => true,
            operationImplementationFields: { type },
        }),
        readMembers: groupOperations.readMembers.implement({
            authorizer: ({ params }) => auth.readMembers({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
        }),
    } as const
}

/**
 * Opt-in member management for the group types that let members simply be added and removed
 * (committees, interest groups and manual groups). Types whose membership is decided elsewhere - a
 * class through the class change/bump system, an omega membership group through admission - must not
 * implement this.
 */
export function implementSimpleAddRemoveMembersOperation({ type, auth }: {
    type: GroupType,
    auth: {
        addMembers: GroupAuthorizerOfGroup,
        removeMembers: GroupAuthorizerOfGroup,
        setMemberAdmin: GroupAuthorizerOfGroup,
        setMemberTitle: GroupAuthorizerOfGroup,
    },
}) {
    return {
        addMembers: groupOperations.addMembers.implement({
            authorizer: ({ params }) => auth.addMembers({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
            beforeRun: ({ prisma, params }) => assertGroupNotPensioned(prisma, params.groupId),
        }),
        removeMembers: groupOperations.removeMembers.implement({
            authorizer: ({ params }) => auth.removeMembers({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
            beforeRun: ({ prisma, params }) => assertGroupNotPensioned(prisma, params.groupId),
        }),
        setMemberAdmin: groupOperations.setMemberAdmin.implement({
            authorizer: ({ params }) => auth.setMemberAdmin({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
            beforeRun: ({ prisma, params }) => assertGroupNotPensioned(prisma, params.groupId),
        }),
        setMemberTitle: groupOperations.setMemberTitle.implement({
            authorizer: ({ params }) => auth.setMemberTitle({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
            beforeRun: ({ prisma, params }) => assertGroupNotPensioned(prisma, params.groupId),
        }),
    } as const
}

/**
 * Migration for the group types that are migrated one group at a time by a human picking who to
 * keep (committees, interest groups and manual groups). A group of such a type sits at either the
 * current omega order (migrated) or one below it (not yet migrated).
 */
export function implementManualMigrationPerGroup({ type, auth, setPensioned }: {
    type: GroupType,
    auth: {
        migrateGroup: GroupAuthorizerOfGroup,
        pension: GroupAuthorizerOfGroup,
    },
    /**
     * How to write the group type's own pensioned flag. Pensioning is the alternative to migrating -
     * a group that is not coming along into the new order is retired instead - which is why it is
     * implemented alongside migration rather than on its own.
     */
    setPensioned: SetPensioned,
}) {
    return {
        migrateGroup: groupOperations.migrateManually.implement({
            authorizer: ({ params }) => auth.migrateGroup({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
            beforeRun: ({ prisma, params }) => assertGroupNotPensioned(prisma, params.groupId),
        }),
        pension: groupOperations.pension.implement({
            authorizer: ({ params }) => auth.pension({ groupId: params.groupId }),
            ownershipCheck: ownershipCheckOfType(type),
            operationImplementationFields: { setPensioned },
        }),
    } as const
}

/**
 * Migration for the group types that follow omega's order without a human in the loop (omega
 * membership groups, study programmes and classes). Every group of the type is brought up to the
 * current order as soon as omega increments; memberships stay where they are.
 */
export function implementStraightAwayMigration({ type, auth }: {
    type: GroupType,
    auth: {
        migrateGroups: Authorizer,
    },
}) {
    return {
        migrateGroups: groupOperations.migrateStraightAwayOfType.implement({
            authorizer: () => auth.migrateGroups,
            ownershipCheck: () => true,
            operationImplementationFields: { type },
        }),
    } as const
}
