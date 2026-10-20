import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import { Require } from '@/auth/authorizer/Require'

export const ledgerMovementAuth = {
    // A deposit only credits the account, but it starts a real payment collection charged to the
    // caller, so it takes a logged-in user depositing to an account they own. LEDGER_ADMIN may
    // deposit to any account. Needs `{ accounts: LedgerAccountOwnership[] }` supplied via `.data()`.
    // The MANUAL-requires-LEDGER_ADMIN rule lives once, in paymentAuth.create, which the payment
    // createPayment makes for a deposit enforces.
    createDeposit: Require.user().permission('LEDGER_USE').allOf(ledgerAccountAccess('LEDGER_ADMIN')),

    // A payout succeeds at once, and an admin then has to transfer the money by hand, so only
    // admins make them, for any account.
    createPayout: Require.permission('LEDGER_USE').permission('LEDGER_ADMIN'),
} as const
