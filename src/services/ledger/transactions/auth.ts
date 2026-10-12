import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import { Require } from '@/auth/authorizer/Require'
import type { LedgerAccountOwnership } from '@/services/ledger/accounts/ownership'

// Both need `{ accounts: LedgerAccountOwnership[] }` supplied via `.data()`.
const ownsEveryAccount = ledgerAccountAccess('LEDGER_ADMIN')
const partyToAnyAccount = ledgerAccountAccess('LEDGER_ADMIN', { mode: 'ANY' })

// Reads are exempt from LEDGER_USE, same as ledgerAccountAuth. Mutations require it.
export const ledgerTransactionAuth = {
    // Being party to one side of the transaction is enough to view it.
    read: partyToAnyAccount,

    readPage: ownsEveryAccount,

    // A system recomputation step, not meant to be called directly by a user. Its real callers
    // (create below, and the Stripe webhook) always pass bypassAuth. LEDGER_ADMIN here is a
    // safety net for any other caller.
    advance: Require.permission('LEDGER_ADMIN'),

    // Additionally requires ownership of every account the transaction debits. A transaction with
    // no debit entries at all (e.g. a deposit, where the debit side is an external payment, not a
    // ledger entry) has nothing to check ownership of, so LEDGER_USE alone is sufficient for it.
    //
    // "No debit entries" is read off the requested IDs, never off the resolved ownerships: an ID
    // that resolves to no account leaves fewer ownerships than IDs, and a debit nobody can be shown
    // to own takes LEDGER_ADMIN.
    //
    // A function since which rule applies depends on the transaction itself.
    create: ({ debitLedgerAccountIds, debitAccounts }: {
        debitLedgerAccountIds: number[],
        debitAccounts: LedgerAccountOwnership[],
    }) => {
        if (debitLedgerAccountIds.length === 0) return Require.permission('LEDGER_USE')
        if (debitAccounts.length !== new Set(debitLedgerAccountIds).size) {
            return Require.permission('LEDGER_USE').permission('LEDGER_ADMIN')
        }
        return Require.permission('LEDGER_USE').allOf(ownsEveryAccount.data({ accounts: debitAccounts }))
    },

    // Being party to one side of the transaction is enough to cancel a stale attempt on it - same
    // bar as read.
    cancel: partyToAnyAccount,
} as const
