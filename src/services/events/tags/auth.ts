import { Require } from '@/auth/authorizer/Require'

export const eventTagAuth = {
    create: Require.permission('EVENT_ADMIN'),
    readSpecial: Require.nothing(),
    read: Require.nothing(),
    readAll: Require.nothing(),
    update: Require.permission('EVENT_ADMIN'),
    destroy: Require.permission('EVENT_ADMIN'),
} as const
