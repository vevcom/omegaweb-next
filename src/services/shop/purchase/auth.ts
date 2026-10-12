import { Require } from '@/auth/authorizer/Require'
import type { Permission } from '@/prisma-generated-pn-types'


export const purchaseAuth = {
    create: Require.permission('SHOP_USE'),
    createByStudentCard: Require.permission('PURCHASE_ADMIN').custom<{ permissionsOfUser: Permission[] }>(
        ({ permissionsOfUser }) => permissionsOfUser.includes('PURCHASE_USE'),
        { errorMessage: 'Brukeren har ikke lov til å handle i butikker.' }
    )
} as const
