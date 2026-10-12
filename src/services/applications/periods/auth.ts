import { Require } from '@/auth/authorizer/Require'

export const applicationPeriodAuth = {
    readAll: Require.permission('APPLICATION_USE'),
    read: Require.permission('APPLICATION_USE'),
    readNumberOfApplications: Require.permission('APPLICATION_USE'),
    create: Require.permission('APPLICATION_ADMIN'),
    update: Require.permission('APPLICATION_ADMIN'),
    removeAllApplicationTexts: Require.permission('APPLICATION_ADMIN'),
    destroy: Require.permission('APPLICATION_ADMIN'),
} as const
