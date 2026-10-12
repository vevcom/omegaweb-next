import { ledgerAccountAccess } from './ownership'
import { Require } from '@/auth/authorizer/Require'
import type { LedgerAccountOwnership } from './ownership'

// Needs `{ accounts: LedgerAccountOwnership[] }` supplied via `.data()`.
const ownsEveryAccount = ledgerAccountAccess('LEDGER_ADMIN')

// Reads are exempt from LEDGER_USE: users can always see their own accounts even if the ledger
// is otherwise disabled. Mutations require LEDGER_USE, plus ownership whenever they act on a
// specific account.
export const ledgerAccountAuth = {
    // USER accounts are created automatically alongside their User, not through this operation
    // (see operations.ts's create). A GROUP account has no owning user to fall back on, so this
    // is LEDGER_ADMIN only.
    create: Require.permission('LEDGER_ADMIN'),

    read: ownsEveryAccount,

    readMany: ownsEveryAccount,

    // Browses every account with no owner filter, so this is LEDGER_ADMIN only, not exempt.
    readPage: Require.permission('LEDGER_ADMIN'),

    // Can reassign an account's group links or payout number, so ownership is required too,
    // even though updating doesn't move money.
    //
    // Group links decide who can access the account (ledgerAccountAccess treats an owning group's
    // members as owners), so changing them takes LEDGER_ADMIN on top, even of a caller who already
    // owns the account. Require.allOf rather than chaining onto the ownership chain: chaining
    // would add LEDGER_ADMIN to its last group only.
    //
    // A function since which rule applies depends on the update itself.
    update: ({ accounts, changesGroupLinks }: {
        accounts: LedgerAccountOwnership[],
        changesGroupLinks: boolean,
    }) => {
        const ownAccount = Require.permission('LEDGER_USE').allOf(ownsEveryAccount.data({ accounts }))
        return changesGroupLinks ? Require.allOf(ownAccount, Require.permission('LEDGER_ADMIN')) : ownAccount
    },

    calculateBalances: ownsEveryAccount,
    calculateBalance: ownsEveryAccount,
} as const
