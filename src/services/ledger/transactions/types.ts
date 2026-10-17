import type { Prisma } from '@/prisma-generated-pn-types'

export type ExpandedLedgerTransaction = Prisma.LedgerTransactionGetPayload<{
    include: {
        ledgerEntries: true,
        payment: {
            include: {
                // Never clientSecret/paymentIntentId here. This type is read broadly by any
                // party to either side of the transaction, per ledgerTransactionAuth.read, not
                // just the payer. The live clientSecret for an in-flight payment comes from
                // ExpandedPayment instead, the direct return of createPayment.
                stripePayment: { select: { createdAt: true, updatedAt: true } },
                manualPayment: true,
            },
        },
        booking: {
            // Never secret, notes, tenantNotes, userId or guestUserId here - read broadly by any
            // party to either side of the transaction, per ledgerTransactionAuth.read, not just
            // the booker. secret in particular authorizes releasing/paying for the booking itself.
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
