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

    // Real callers (createPayment/createDeposit) pass bypassAuth after authorizing the resource.
    // LEDGER_USE is a safety net, not an ownership check, so admins can still pay for others.
    initiate: Require.permission('LEDGER_USE'),
} as const
