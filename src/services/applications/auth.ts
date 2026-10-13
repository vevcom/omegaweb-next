import { Require } from '@/auth/authorizer/Require'

const userIdOrApplicationAdmin = Require.permission('APPLICATION_ADMIN').or().userId()

export const applicationAuth = {
    readForUser: userIdOrApplicationAdmin,
    create: userIdOrApplicationAdmin,
    update: userIdOrApplicationAdmin,
    destroy: userIdOrApplicationAdmin,
} as const
