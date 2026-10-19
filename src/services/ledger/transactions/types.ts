import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedLedgerTransaction = Prisma.LedgerTransactionGetPayload<{
    include: {
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
    }
}>
