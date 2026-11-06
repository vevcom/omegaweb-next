import { Require } from '@/auth/authorizer/Require'

const revueAdmin = Require.permission('REVUE_ADMIN')

export const revueAuth = {
    create: revueAdmin,
    readMany: Require.nothing(),
    read: Require.nothing(),
    update: revueAdmin,
    destroy: revueAdmin,
    updateArticle: revueAdmin,
} as const
