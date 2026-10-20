import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'

// How long a PENDING transaction, such as an abandoned Stripe checkout, stays open before the
// ledger sweeper cancels it.
export const stalePendingTransactionMs = 30 * 60 * 1000

// The purposes whose transactions wait for the payment completion worker once they succeed. The
// hooks themselves live in paymentCompletionHooks.ts, which the transactions can't import, since
// the hooks import the domains that pay through the ledger.
export const paymentCompletionHookPurposes = ['CABIN_BOOKING'] as const satisfies LedgerTransactionPurpose[]

export type PaymentCompletionHookPurpose = (typeof paymentCompletionHookPurposes)[number]

export function hasPaymentCompletionHook(purpose: LedgerTransactionPurpose): purpose is PaymentCompletionHookPurpose {
    return paymentCompletionHookPurposes.some(hookPurpose => hookPurpose === purpose)
}

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
