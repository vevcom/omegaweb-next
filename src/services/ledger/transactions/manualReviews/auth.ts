import { Require } from '@/auth/authorizer/Require'

export const manualReviewAuth = {
    readOpen: Require.permission('LEDGER_ADMIN'),
    resolve: Require.permission('LEDGER_ADMIN'),
} as const
