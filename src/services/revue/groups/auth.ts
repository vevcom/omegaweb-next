import { Require } from '@/auth/authorizer/Require'

const revueAdmin = Require.permission('REVUE_ADMIN')

export const revueGroupAuth = {
    create: revueAdmin,
    read: Require.nothing(),
    update: revueAdmin,
    destroy: revueAdmin,
    updateArticleSection: revueAdmin,
} as const
