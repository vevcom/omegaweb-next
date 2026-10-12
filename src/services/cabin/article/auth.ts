import { Require } from '@/auth/authorizer/Require'

export const cabinArticleAuth = {
    read: Require.nothing(),
    update: Require.permission('CABIN_ADMIN')
} as const
