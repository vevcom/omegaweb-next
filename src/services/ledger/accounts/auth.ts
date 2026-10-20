import { ledgerAccountAccess, ownedAccountsWhere } from './ownership'
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

    // Lists rather than checks: a user gets its own accounts through the filter, LEDGER_ADMIN
    // every account, unfiltered.
    readAccessible: Require.permission('LEDGER_ADMIN').or().user().filter(({ session }) => ownedAccountsWhere(session)),

    // Browses every account with no owner filter, so this is LEDGER_ADMIN only, not exempt.
    readPage: Require.permission('LEDGER_ADMIN'),

    // An owner may rename their account, set its payout account number, and freeze it, which only
    // stops spending - ownership plus LEDGER_USE is enough. The data schema (see
    // ledgerAccountSchemas.data.update) keeps this operation from ever expressing an unfreeze, so
    // nothing here needs to re-check that itself.
    update: ({ accounts }: { accounts: LedgerAccountOwnership[] }) =>
        Require.permission('LEDGER_USE').allOf(ownsEveryAccount.data({ accounts })),

    // Changing an account's group links (which decide who owns it - ledgerAccountAccess treats an
    // owning group's members as owners) or unfreezing it (so an account an admin froze stays
    // frozen) takes LEDGER_ADMIN on top of ownership, even for a caller who owns the account.
    // Require.allOf rather than chaining onto the ownership chain: chaining would add LEDGER_ADMIN
    // to its last group only.
    updateAsAdmin: ({ accounts }: { accounts: LedgerAccountOwnership[] }) =>
        Require.allOf(
            Require.permission('LEDGER_USE').allOf(ownsEveryAccount.data({ accounts })),
            Require.permission('LEDGER_ADMIN'),
        ),

    calculateBalance: ownsEveryAccount,
} as const
