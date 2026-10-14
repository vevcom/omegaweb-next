import type { LedgerAccountOwnership } from './ownership'
import type { LedgerAccount } from '@/prisma-generated-pn-types'

// NOTE: `amount` and `fees` are stored as integers representing
// hundredths (1/100) of a Klinguende Meunt.
// (We should have a name for this. "Klinguende Cent"? "Klinguende Meuntling"?)
export type Balance = {
    amount: number,
    fees: number,
}

export type ExpandedLedgerAccount = LedgerAccount & {
    groupIds: number[],
    /** Who owns the account, for the pages to run the ownership rules of what they offer on it. */
    ownership: LedgerAccountOwnership,
}

// TODO: Should this also be partial? It cannot possibly contain all number IDs.
export type BalanceRecord = Record<number, Balance>
