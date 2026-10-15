import type { permissionCategories } from './constants'

export type PermissionCategory = typeof permissionCategories[number]
export type PermissionInfo = {
    name: string,
    description: string,
    category: PermissionCategory,
    /** Whether the permission may be a default permission, which everyone holds - visitors too. */
    canBeDefault: boolean,
}

