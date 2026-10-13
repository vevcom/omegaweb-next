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

export const expandedLedgerTransactionIncluder = {
    ledgerEntries: true,
    payment: {
        include: {
            // Never clientSecret/paymentIntentId here. This is read broadly by any party to
            // either side of the transaction, per ledgerTransactionAuth.read, not just the payer.
            // The live clientSecret for an in-flight payment comes from ExpandedPayment instead,
            // the direct return of createPayment.
            stripePayment: { select: { createdAt: true, updatedAt: true } },
            manualPayment: true,
        },
    },
    booking: {
        // Never secret, notes, tenantNotes, userId or guestUserId here - read broadly by any
        // party to either side of the transaction, per ledgerTransactionAuth.read, not just the
        // booker. secret in particular authorizes releasing/paying for the booking itself.
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
