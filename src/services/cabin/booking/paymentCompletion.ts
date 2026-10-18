import { sendCabinBookingConfirmationMail } from '@/lib/email/systemMail/cabinBookingConfirmation'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { blocksCalendar } from '@/services/cabin/booking/operations'
import { createManualReview } from '@/services/ledger/transactions/manualReview'
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

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: transaction.bookingId } })

    // The hold on a booking is time-boxed, not tied to the payment's real completion. A Stripe
    // webhook can still arrive after that window expired, once another booking has already
    // taken and paid for the same dates. This check is a backstop for that race.
    //
    // The real fix is a sweeper that cancels a PENDING transaction once its hold expires. That
    // also cancels its Stripe PaymentIntent, so a late success can never arrive in the first
    // place. Remove this check once that sweeper exists.
    const conflicting = await prisma.booking.findFirst({
        where: {
            id: { not: booking.id },
            start: { lt: booking.end },
            end: { gt: booking.start },
            ...blocksCalendar(),
        },
    })

    if (conflicting) {
        await prisma.booking.update({ where: { id: booking.id }, data: { canceled: new Date() } })

        if (booking.userId) {
            const payerAccount = await ledgerAccountOperations.read({
                params: { userId: booking.userId },
                bypassAuth: true,
                prisma,
            })
            await refundOperations.reverseTransaction({
                params: {
                    originalTransactionId: transaction.id,
                    reason: 'Hytta ble dobbeltbooket av en annen reservasjon mens betalingen pågikk.',
                    refundTo: [{ ledgerAccountId: payerAccount.id }],
                },
                prisma,
                bypassAuth: true,
            })
        } else {
            // A guest booking has no session and no ledger account to credit. This needs a
            // human to issue an actual Stripe refund. Uses the ambient prisma, not the default
            // top-level client, so the review commits together with the booking cancellation
            // above - if this transaction ever rolls back, the review shouldn't outlive it either.
            await createManualReview(
                transaction.id,
                'Hytta ble dobbeltbooket av en annen reservasjon mens betalingen pågikk for booking '
                + `${booking.id}, men gjesten har ingen konto å refundere til automatisk.`,
                { prisma }
            )
        }
        return
    }

    const confirmedBooking = await prisma.booking.update({
        where: { id: transaction.bookingId },
        data: { transactionTimeout: null },
        include: {
            user: { select: { email: true, firstname: true } },
            guestUser: { select: { email: true, firstname: true } },
        },
    })

    await sendBookingConfirmation(confirmedBooking)
}
