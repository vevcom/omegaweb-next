import { Require } from '@/auth/authorizer/Require'

const groupAdminOrApplicationAdmin = Require.permission('APPLICATION_ADMIN').or().groupAdmin()

export const committeeParticipationAuth = {
    read: groupAdminOrApplicationAdmin,
    readAll: groupAdminOrApplicationAdmin,
} as const
