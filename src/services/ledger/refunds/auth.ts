import { Require } from '@/auth/authorizer/Require'

// Neither is meant to be called directly by a user. Real callers (the Stripe webhook, cabin's
// double-booking correction, event unregister) always pass bypassAuth. LEDGER_ADMIN here is a
// safety net for any other caller, same pattern as ledgerTransactionAuth.advance.
export const refundAuth = {
    refund: Require.permission('LEDGER_ADMIN'),
    reimburseUnappliedPayment: Require.permission('LEDGER_ADMIN'),
} as const
