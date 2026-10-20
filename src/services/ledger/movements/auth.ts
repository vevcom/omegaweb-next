import { Require } from '@/auth/authorizer/Require'

export const ledgerMovementAuth = {
    // A deposit credits the account rather than debiting it, so LEDGER_USE alone is enough here.
    // The MANUAL-requires-LEDGER_ADMIN rule lives once, in paymentAuth.create, which the payment
    // createPayment makes for a deposit enforces.
    createDeposit: Require.permission('LEDGER_USE'),

    // A payout succeeds at once, and an admin then has to transfer the money by hand, so only
    // admins make them, for any account.
    createPayout: Require.permission('LEDGER_USE').permission('LEDGER_ADMIN'),
} as const
