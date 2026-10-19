import { manualReviewOperations } from './manualReviews/operations'
import { cabinBookingPaymentCompletionHook } from '@/services/cabin/booking/paymentCompletion'
import type { ExpandedLedgerTransaction } from './types'
import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'

/**
 * Lets a domain react once a transaction for its purpose reaches SUCCEEDED (e.g. send a
 * confirmation). It can only fail its own side effects, never the payment. `prisma` is the
 * client ambient in the advance() call that triggered it.
 */
export type PaymentCompletionHook = (
    transaction: ExpandedLedgerTransaction,
    context: { prisma: Prisma.TransactionClient },
) => Awaitable<void>

/**
 * Hooks per LedgerTransactionPurpose, dispatched by advance(). Most purposes have none. See
 * cabin/booking/paymentCompletion.ts for an example.
 */
const paymentCompletionHooks: Partial<Record<LedgerTransactionPurpose, PaymentCompletionHook>> = {
    CABIN_BOOKING: cabinBookingPaymentCompletionHook,
}

/**
 * Runs the hook for the transaction's purpose, if any. Never throws, so a failing side effect
 * can't make the caller (e.g. the webhook) treat the payment as failed.
 */
export async function runPaymentCompletionHook(
    transaction: ExpandedLedgerTransaction,
    context: { prisma: Prisma.TransactionClient },
): Promise<void> {
    const hook = paymentCompletionHooks[transaction.purpose]
    if (!hook) return

    try {
        await hook(transaction, context)
    } catch (error) {
        // context.prisma, not the top-level client: the transaction row this review references
        // was created by that same connection and isn't visible to any other one until it
        // commits.
        await manualReviewOperations.create({
            params: {
                transactionId: transaction.id,
                problem: 'COMPLETION_HOOK_FAILED',
                problemDescription: `Fullføringshook for ${transaction.purpose} feilet etter vellykket betaling.`,
                error,
            },
            prisma: context.prisma,
            bypassAuth: true,
        })
    }
}
