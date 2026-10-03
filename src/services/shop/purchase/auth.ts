
import { Require } from '@/auth/authorizer/Require'
import type { Permission } from '@/prisma-generated-pn-types'
import { RequirePermissionAndDynamicPermission } from '@/auth/authorizer/RequirePermissionAndDynamicPermission'
import { RequirePermissionAndUserId } from '@/auth/authorizer/RequirePermissionAndUserId'


export const purchaseAuth = {
    create: RequirePermissionAndUserId.staticFields({
        permission: 'PURCHASE_CREATE',
    }),
    createByStudentCard: Require.permission('PURCHASE_ADMIN').custom<{ permissionsOfUser: Permission[] }>(
        ({ permissionsOfUser }) => permissionsOfUser.includes('PURCHASE_USE'),
        { errorMessage: 'Brukeren har ikke lov til å handle i butikker.' }
}
