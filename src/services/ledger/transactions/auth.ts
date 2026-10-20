import { ledgerAccountAccess } from '@/services/ledger/accounts/ownership'
import { Require } from '@/auth/authorizer/Require'
import type { LedgerAccountOwnership } from '@/services/ledger/accounts/ownership'

// Needs `{ accounts: LedgerAccountOwnership[] }` supplied via `.data()`.
const ownsEveryAccount = ledgerAccountAccess('LEDGER_ADMIN')

// Reads are exempt from LEDGER_USE, same as ledgerAccountAuth. Mutations require it.
export const ledgerTransactionAuth = {
    readPage: ownsEveryAccount,

    // Also requires owning every debited account; with no debit entries (e.g. a deposit) LEDGER_USE
    // is enough. Read off the requested ids, so an id resolving to no account takes LEDGER_ADMIN.
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

    // Users never need to: the ledger sweeper cancels an abandoned attempt once it is stale.
    cancel: Require.permission('LEDGER_ADMIN'),
} as const
