import type { Prisma } from '@/prisma-generated-pn-types'

// How long a PENDING transaction attempt (e.g. an abandoned Stripe checkout) is treated as
// still legitimately in flight before a new payment attempt for the same resource is allowed to
// cancel it and retry. Long enough not to race a real, slow-but-active checkout; short enough
// that an abandoned one doesn't lock a user out for good.
export const stalePendingTransactionMs = 30 * 60 * 1000

// Whether a transaction's SUCCEEDED state is still actually in effect. A refund never changes
// the original transaction's own state, which stays SUCCEEDED forever as a historical journal
// entry, so "has this been paid for" is this filter, not state alone. Named generically rather
// than after refunds specifically, so another condition that invalidates a transaction can be
// folded into it later without a rename. Use it anywhere that question is asked, instead of
// checking state on its own.
export const validTransactionFilter = {
    state: 'SUCCEEDED',
    refundOf: null,
} satisfies Prisma.LedgerTransactionWhereInput
