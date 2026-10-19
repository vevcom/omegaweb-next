import { Require } from '@/auth/authorizer/Require'

const baseAuthorizer = Require.permission('CABIN_ADMIN')

export const cabinReleasePeriodAuth = {
    create: baseAuthorizer,
    destroy: baseAuthorizer,
    readMany: Require.permission('CABIN_USE'),
    getCurrentReleasePeriod: baseAuthorizer,
    update: baseAuthorizer,
} as const
