import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import { Require } from '@/auth/authorizer/Require'

export const ledgerMovementAuth = {
    // A deposit credits the account rather than debiting it, so LEDGER_USE alone is enough here.
    // The MANUAL-requires-LEDGER_ADMIN rule lives once, in paymentAuth.create - createDeposit's
    // own (not bypassed) call to paymentOperations.create enforces it there.
    createDeposit: Require.permission('LEDGER_USE'),

    // A payout debits the account, so ownership is required in addition to LEDGER_USE. Needs
    // `{ accounts: LedgerAccountOwnership[] }` supplied via `.data()`.
    createPayout: Require.permission('LEDGER_USE').allOf(ledgerAccountAccess('LEDGER_ADMIN')),
} as const
