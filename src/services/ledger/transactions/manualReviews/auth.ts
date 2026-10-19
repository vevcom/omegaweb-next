import { Require } from '@/auth/authorizer/Require'

// Admin-only throughout. `create`'s real callers always pass bypassAuth - this is a safety net
// for any other caller, the same convention ledgerTransactionAuth.advance/initiate use.
export const manualReviewAuth = {
    create: Require.permission('LEDGER_ADMIN'),
    readOpen: Require.permission('LEDGER_ADMIN'),
    resolve: Require.permission('LEDGER_ADMIN'),
} as const
