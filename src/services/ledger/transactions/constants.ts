import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'

/** What each purpose is called, which a transaction's title starts with or falls back to, and its search matches. */
export const transactionPurposeNames: Record<LedgerTransactionPurpose, string> = {
    SHOP_PURCHASE: 'Kjøp i butikk',
    EVENT_PAYMENT: 'Påmelding',
    CABIN_BOOKING: 'Hyttebooking',
    DEPOSIT: 'Innskudd',
    PAYOUT: 'Utbetaling',
    REFUND: 'Refusjon',
}

/** Which way the money moves for the account a list of transactions is of. */
export const ledgerTransactionDirections = ['IN', 'OUT'] as const

/** The account's own entry in a transaction going each way, which is the sign of its balance change. */
export const ledgerTransactionDirectionFilters = {
    IN: { funds: { gt: 0 } },
    OUT: { funds: { lt: 0 } },
} as const satisfies Record<typeof ledgerTransactionDirections[number], Prisma.LedgerEntryWhereInput>

// How long a PENDING transaction, such as an abandoned Stripe checkout, stays open before the
// ledger sweeper cancels it.
export const stalePendingTransactionMs = 30 * 60 * 1000

// A SUCCEEDED transaction that hasn't been refunded. A refund leaves the original SUCCEEDED,
// so use this instead of checking state alone to ask "has this been paid for".
export const validTransactionFilter = {
    state: 'SUCCEEDED',
    refundOf: null,
} satisfies Prisma.LedgerTransactionWhereInput

// The variant, and through it the event, a registration's payment is for.
const eventVariantOfPaymentSelection = {
    name: true,
    event: { select: { name: true, location: true, eventStart: true, eventEnd: true } },
} as const satisfies Prisma.EventVariantSelect

export const expandedLedgerTransactionIncluder = {
    ledgerEntries: true,
    payment: {
        include: {
            // Never clientSecret/paymentIntentId: both sides can read this. The payer gets
            // the clientSecret from ExpandedPayment instead.
            stripePayment: { select: { createdAt: true, updatedAt: true } },
            manualPayment: true,
            // The account of the user it is from, which paying by card alone leaves off the entries.
            user: { select: { ledgerAccountId: true } },
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
    // A paid registration holds a place, shown through its quota, or sits on the waiting list of its
    // variant should it have lost the place after paying.
    eventRegistration: {
        include: {
            quota: { select: { name: true, variant: { select: eventVariantOfPaymentSelection } } },
            waitingListVariant: { select: eventVariantOfPaymentSelection },
        },
    },
    purchase: {
        include: {
            shop: { select: { name: true } },
            PurchaseProduct: { include: { product: { select: { name: true } } } },
        },
    },
} as const satisfies Prisma.LedgerTransactionInclude
