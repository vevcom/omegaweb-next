import type { Prisma } from '@/prisma-generated-pn-types'

// How long a PENDING transaction, such as an abandoned Stripe checkout, stays open before the
// ledger sweeper cancels it.
export const stalePendingTransactionMs = 30 * 60 * 1000

// A SUCCEEDED transaction that hasn't been refunded. A refund leaves the original SUCCEEDED,
// so use this instead of checking state alone to ask "has this been paid for".
export const validTransactionFilter = {
    state: 'SUCCEEDED',
    refundOf: null,
} satisfies Prisma.LedgerTransactionWhereInput

// What a transaction is read with everywhere, see ExpandedLedgerTransaction. Both sides of a
// transaction can read it, so it leaves out the payment's clientSecret and paymentIntentId, which
// the payer gets from ExpandedPayment instead, and the booking's secret, notes, tenantNotes, userId
// and guestUserId.
export const expandedLedgerTransactionInclude = {
    ledgerEntries: true,
    payment: {
        include: {
            stripePayment: { select: { createdAt: true, updatedAt: true } },
            manualPayment: true,
        },
    },
    booking: {
        select: {
            start: true,
            end: true,
            numberOfMembers: true,
            numberOfNonMembers: true,
            totalPrice: true,
            event: { select: { name: true } },
        },
    },
    eventRegistration: {
        include: {
            event: { select: { name: true, location: true, eventStart: true, eventEnd: true } },
        },
    },
    purchase: {
        include: {
            shop: { select: { name: true } },
            PurchaseProduct: { include: { product: { select: { name: true } } } },
        },
    },
} satisfies Prisma.LedgerTransactionInclude
