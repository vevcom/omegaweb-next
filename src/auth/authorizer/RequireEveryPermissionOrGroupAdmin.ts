import { Require } from './Require'
import type { Permission } from '@/prisma-generated-pn-types'

/**
 * Every one of the permissions, or an active admin membership of the group in question. Needs
 * `{ groupId: number }` supplied via `.data()`.
 *
 * The group admin arm is what `Require.groupAdmin` offers for the mutations; this is the same
 * idea for an operation that takes more than one permission, so that administering a group and
 * reading who is in it do not come apart.
 */
export function requireEveryPermissionOrGroupAdmin(permissions: Permission[]) {
    const everyPermission = permissions.reduce((builder, permission) => builder.permission(permission), Require)
    return everyPermission.or().groupAdmin()
}
