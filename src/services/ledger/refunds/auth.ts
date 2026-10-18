import { Require } from '@/auth/authorizer/Require'

// Not meant to be called directly by a user. Real callers (cabin's double-booking correction,
// event unregister) always pass bypassAuth. LEDGER_ADMIN here is a safety net for any other
// caller, same pattern as ledgerTransactionAuth.advance.
export const refundAuth = {
    reverseTransaction: Require.permission('LEDGER_ADMIN'),
} as const
