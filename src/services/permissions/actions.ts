'use server'

import { makeAction } from '@/services/serverAction'
import { permissionOperations } from '@/services/permissions/operations'

export const readDefaultPermissionsAction = makeAction(permissionOperations.readDefaultPermissions)
export const updateDefaultPermissionsAction = makeAction(permissionOperations.updateDefaultPermissions)
export const updateGroupPermissionAction = makeAction(permissionOperations.updateGroupPermission)
