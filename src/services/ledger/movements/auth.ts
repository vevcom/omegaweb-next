import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import { Require } from '@/auth/authorizer/Require'

// Needs `{ accounts: LedgerAccountOwnership[] }` supplied via `.data()`.
const ownsEveryAccount = ledgerAccountAccess('LEDGER_ADMIN')

export const ledgerMovementAuth = {
    // A deposit only credits the account, but it starts a real payment collection charged to the
    // caller, so it takes a logged-in user depositing to an account they own. LEDGER_ADMIN may
    // deposit to any account. The MANUAL-requires-LEDGER_ADMIN rule lives once, in
    // paymentAuth.create - createDeposit's own (not bypassed) call to paymentOperations.create
    // enforces it there.
    createDeposit: Require.user().permission('LEDGER_USE').allOf(ownsEveryAccount),

    // A payout debits the account, so ownership is required in addition to LEDGER_USE.
    createPayout: Require.permission('LEDGER_USE').allOf(ownsEveryAccount),
} as const
