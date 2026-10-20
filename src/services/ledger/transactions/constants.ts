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

export const expandedLedgerTransactionIncluder = {
    ledgerEntries: true,
    payment: {
        include: {
            // Never clientSecret/paymentIntentId: both sides can read this. The payer gets
            // the clientSecret from ExpandedPayment instead.
            stripePayment: { select: { createdAt: true, updatedAt: true } },
            manualPayment: true,
        },
    },
    booking: {
        // Never secret, notes, tenantNotes, userId or guestUserId: both sides can read this.
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
} as const satisfies Prisma.LedgerTransactionInclude
