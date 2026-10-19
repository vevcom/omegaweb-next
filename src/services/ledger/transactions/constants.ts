import type { Prisma } from '@/prisma-generated-pn-types'

// How long a PENDING attempt (e.g. an abandoned Stripe checkout) blocks a new attempt from
// cancelling it and retrying.
export const stalePendingTransactionMs = 30 * 60 * 1000

// A SUCCEEDED transaction that hasn't been refunded. A refund leaves the original SUCCEEDED,
// so use this instead of checking state alone to ask "has this been paid for".
export const validTransactionFilter = {
    state: 'SUCCEEDED',
    refundOf: null,
} satisfies Prisma.LedgerTransactionWhereInput
