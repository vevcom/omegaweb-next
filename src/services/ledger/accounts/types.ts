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
    // Who may act on the account, for authorizers that take `{ accounts }`.
    ownership: LedgerAccountOwnership,
}

// TODO: Should this also be partial? It cannot possibly contain all number IDs.
export type BalanceRecord = Record<number, Balance>
