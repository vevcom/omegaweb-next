import { Require } from '@/auth/authorizer/Require'

export const cabinSettingsAuth = {
    read: Require.permission('CABIN_ADMIN'),
    update: Require.permission('CABIN_ADMIN'),
} as const
