import { Require } from '@/auth/authorizer/Require'

const revueAdmin = Require.permission('REVUE_ADMIN')

export const revueGroupMemberAuth = {
    create: revueAdmin,
    update: revueAdmin,
    destroy: revueAdmin,
} as const
