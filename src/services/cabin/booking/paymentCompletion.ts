import { sendCabinBookingConfirmationMail } from '@/lib/email/systemMail/cabinBookingConfirmation'
import type { ConfirmedBooking } from '@/lib/email/systemMail/cabinBookingConfirmation'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { Prisma } from '@/prisma-generated-pn-types'

type Recipient = { email: string, firstname: string } | null

/**
 * Sent once payment succeeds, not at reservation time - a reservation may still expire unpaid.
 * The booker is a user or a guest; a booking with neither (an event blocking the cabin) confirms
 * nothing.
 */
export async function sendBookingConfirmation(
    booking: ConfirmedBooking & { user: Recipient, guestUser: Recipient }
) {
    const recipient = booking.user ?? booking.guestUser
    if (!recipient) return

    await sendCabinBookingConfirmationMail(recipient, booking)
}

/**
 * Registered under CABIN_BOOKING in ledger/transactions/paymentCompletionHooks.ts, so
 * ledgerTransactionOperations.advance calls this the moment a cabin booking's transaction
 * actually reaches SUCCEEDED - whether that happens synchronously (a MANUAL or balance-only
 * payment, from cabinBookingOperations.createPayment) or asynchronously (a STRIPE payment,
 * confirmed later via the webhook). This is the one place that reacts to the booking's payment
 * succeeding: it clears the reservation window (the booking now blocks the calendar
 * unconditionally instead of expiring) and sends the confirmation.
 */
export async function cabinBookingPaymentCompletionHook(
    transaction: ExpandedLedgerTransaction,
    { prisma }: { prisma: Prisma.TransactionClient },
): Promise<void> {
    if (transaction.bookingId === null) return

    const booking = await prisma.booking.update({
        where: { id: transaction.bookingId },
        data: { transactionTimeout: null },
        include: {
            user: { select: { email: true, firstname: true } },
            guestUser: { select: { email: true, firstname: true } },
        },
    })

    await sendBookingConfirmation(booking)
}
