import { notificationOperations } from '@/services/notifications/operations'
import { sendMailOperations } from '@/services/notifications/send-mail/operations'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { Prisma } from '@/prisma-generated-pn-types'

const mailData = {
    title: 'Bekreftelse på hyttebooking',
    message: `Takk for din hyttebooking.
Dette skal være en bookingbekreftelse, så det bør nok komme noe nyttig info her snart.`,
}

/**
 * Sent once payment succeeds, not at reservation time - a reservation may still expire unpaid.
 */
export async function sendBookingConfirmation(
    booking: { userId: number | null, guestUser: { email: string } | null }
) {
    if (booking.userId !== null) {
        await notificationOperations.createSpecial.internalCall({
            params: {
                special: 'CABIN_BOOKING_CONFIRMATION',
            },
            data: {
                ...mailData,
                audience: { userIds: [booking.userId] },
            },
        })
        return
    }

    if (booking.guestUser) {
        await sendMailOperations.internal.sendSystemMail.internalCall({
            data: {
                to: booking.guestUser.email,
                subject: mailData.title,
                body: mailData.message,
            },
        })
    }
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
        include: { guestUser: true },
    })

    await sendBookingConfirmation(booking)
}
