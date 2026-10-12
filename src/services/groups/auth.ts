import { requireEveryPermissionOrGroupAdmin } from '@/auth/authorizer/RequireEveryPermissionOrGroupAdmin'
import { Require } from '@/auth/authorizer/Require'
import type { Permission } from '@/prisma-generated-pn-types'

/**
 * The authorizer every group type's `readMembers` uses. Reading a group's members hands out the
 * users behind the memberships, so it takes permission to read users on top of permission to read
 * the group type itself - a group type's own read permission is not enough on its own.
 *
 * `CLASS_USE` and `MANUAL_GROUP_USE` are default permissions (seeded in development by
 * `seedDevPermissions.ts`), and `ServerSession.fromNextAuth` falls back to the default permissions
 * when there is no session, so a `readMembers` gated on one of those alone is callable by a
 * visitor who is not logged in at all.
 *
 * `USERS_USE` is a membership permission, so for the group types whose own read permission is a
 * membership permission too this adds nothing - which is the point. The rule holds for every type
 * rather than being a patch on the two that need it, so a group type that is made readable by
 * default later cannot start handing out member data by doing so.
 */
export function requireReadGroupMembers(groupTypeReadPermission: Permission) {
    return Require.permission(groupTypeReadPermission).permission('USERS_USE')
}

/**
 * The `readMembers` authorizer for the group types someone administers by hand - committees,
 * interest groups, manual groups and study programmes.
 *
 * `RequirePermissionOrGroupAdmin` lets a group's own admin add, remove and retitle its members
 * without holding the group type's admin permission. Gating the member list on permissions alone
 * would leave that admin managing a group whose members they may not see - and the pages that offer
 * the management read the members first, so they would be turned away before reaching it. An active
 * admin membership therefore passes here too.
 *
 * The permission arm is unchanged from `requireReadGroupMembers`, so nothing that could read a
 * group's members before can read less now. Group types nobody administers this way - classes and
 * omega membership groups, whose membership is decided elsewhere - keep the plain authorizer, so a
 * default read permission still cannot hand out a roster to a visitor.
 */
export function requireReadManagedGroupMembers(groupTypeReadPermission: Permission) {
    return requireEveryPermissionOrGroupAdmin([groupTypeReadPermission, 'USERS_USE'])
}

/**
 * The authorizer every group type's `readMembershipsOfUser` uses. A user may always see their own
 * memberships. Anyone else needs what `requireReadGroupMembers` asks for, and for the same reason:
 * the memberships say something about the user, and the group type's own read permission may be a
 * default permission that a visitor who is not logged in holds as well.
 */
export function requireReadMembershipsOfUser(groupTypeReadPermission: Permission) {
    return Require.userId().or().permission(groupTypeReadPermission).permission('USERS_USE')
}
