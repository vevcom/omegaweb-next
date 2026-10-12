import { Require } from '@/auth/authorizer/Require'
import type { Permission } from '@/prisma-generated-pn-types'

export const purchaseAuth = {
    // Needs `{ permissionsOfUser: Permission[] }` supplied via `.data()`: the permissions of the
    // user the card belongs to, not of the session.
    createByStudentCard: Require.permission('PURCHASE_ADMIN').custom<{ permissionsOfUser: Permission[] }>(
        ({ permissionsOfUser }) => permissionsOfUser.includes('PURCHASE_USE'),
        { errorMessage: 'Brukeren har ikke lov til å handle i butikker.' }
    )
} as const
