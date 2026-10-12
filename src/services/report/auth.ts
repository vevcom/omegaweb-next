import { Require } from '@/auth/authorizer/Require'

export const reportAuth = {
    read: Require.user(),
    update: Require.permission('REPORT_ADMIN')
} as const
