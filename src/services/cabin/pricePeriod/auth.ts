import { Require } from '@/auth/authorizer/Require'

const baseAuthorizer = Require.permission('CABIN_ADMIN')

export const cabinPricePeriodAuth = {
    create: baseAuthorizer,
    destroy: baseAuthorizer,
    readMany: baseAuthorizer,
    readPublicPeriods: Require.permission('CABIN_USE'),
    readUnreleasedPeriods: baseAuthorizer,
    update: baseAuthorizer,
} as const
