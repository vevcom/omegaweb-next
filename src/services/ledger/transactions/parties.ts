import type { Prisma } from '@/prisma-generated-pn-types'

/** What a transaction's parties are read off. An ExpandedLedgerTransaction holds it too. */
export const transactionPartiesSelection = {
    ledgerEntries: { select: { ledgerAccountId: true, funds: true } },
    payment: { select: { user: { select: { ledgerAccountId: true } } } },
} as const satisfies Prisma.LedgerTransactionSelect

export type TransactionParties = {
    ledgerEntries: { ledgerAccountId: number, funds: number }[],
    payment: { user: { ledgerAccountId: number } | null } | null,
}

// The money of a payment comes from its user, whose account the transaction may not debit at all.
const payingUserAccountIds = (transaction: TransactionParties) => (
    transaction.payment?.user ? [transaction.payment.user.ledgerAccountId] : []
)

/** Every account a transaction involves: those of its entries, and that of the user its payment is from. */
export function partyAccountIds(transaction: TransactionParties): number[] {
    return [...transaction.ledgerEntries.map(entry => entry.ledgerAccountId), ...payingUserAccountIds(transaction)]
}

/** The accounts a transaction is paid from: those it debits, and that of the user its payment is from. */
export function payerAccountIds(transaction: TransactionParties): number[] {
    return [
        ...transaction.ledgerEntries.filter(entry => entry.funds < 0).map(entry => entry.ledgerAccountId),
        ...payingUserAccountIds(transaction),
    ]
}
