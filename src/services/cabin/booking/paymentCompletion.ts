import { sendCabinBookingConfirmationMail } from '@/lib/email/systemMail/cabinBookingConfirmation'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { blocksCalendar } from '@/services/cabin/booking/operations'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
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
 * Run by the payment completion worker once a cabin booking's transaction has SUCCEEDED (see
 * paymentCompletionHooks.ts). Clears the reservation window and sends the confirmation.
 */
export async function cabinBookingPaymentCompletionHook(
    transaction: ExpandedLedgerTransaction,
    { prisma }: { prisma: Prisma.TransactionClient },
): Promise<void> {
    if (transaction.bookingId === null) return

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: transaction.bookingId } })

    // A booking paid within its hold blocked the calendar the whole time, so nothing else can have
    // taken its dates. Checking anyway would let a booking paid after its own hold ran out win.
    const paidWithinHold = booking.transactionTimeout === null || (
        transaction.completionHookRequestedAt !== null
        && transaction.completionHookRequestedAt <= booking.transactionTimeout
    )

    // Backstop: the hold is time-boxed, so a late Stripe webhook can arrive after another booking
    // took the same dates. The ledger sweeper cancels stale attempts, but not before the hold ends
    // or while the worker is down.
    const conflicting = !paidWithinHold && await prisma.booking.findFirst({
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
                    refundTo: payerAccount.id,
                },
                prisma,
                bypassAuth: true,
            })
        } else {
            // A guest has no ledger account, so a human must refund through Stripe. Uses the ambient
            // prisma, so the review rolls back with the booking cancellation.
            await manualReviewOperations.create({
                params: {
                    transactionId: transaction.id,
                    problem: 'CABIN_DOUBLE_BOOKING',
                    problemDescription: 'Hytta ble dobbeltbooket av en annen reservasjon mens betalingen pågikk for '
                        + `booking ${booking.id}, men gjesten har ingen konto å refundere til automatisk.`,
                },
                prisma,
                bypassAuth: true,
            })
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
