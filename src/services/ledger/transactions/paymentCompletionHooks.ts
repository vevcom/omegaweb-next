import { manualReviewOperations } from './manualReviews/operations'
import { cabinBookingPaymentCompletionHook } from '@/services/cabin/booking/paymentCompletion'
import type { ExpandedLedgerTransaction } from './types'
import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'

/**
 * A hook a domain registers to react once a ledger transaction for one of its purposes has
 * actually reached SUCCEEDED - e.g. sending a confirmation, fulfilling an order. Runs after the
 * transaction's own state is already committed, so a hook can only fail its own side effects
 * (see runPaymentCompletionHook below), never the payment itself.
 *
 * `prisma` is whatever client is ambient in the ledgerTransactionOperations.advance call that
 * triggered this - the same transaction as the state update when advance runs synchronously
 * inside create(), or a plain client when advance runs standalone (e.g. from the Stripe
 * webhook).
 */
export type PaymentCompletionHook = (
    transaction: ExpandedLedgerTransaction,
    context: { prisma: Prisma.TransactionClient },
) => Promise<void>

/**
 * The single table every domain's "what happens when payment for X succeeds" hook is registered
 * in, keyed by LedgerTransactionPurpose. ledgerTransactionOperations.advance dispatches through
 * this generically - it never needs to know about any specific domain. Most purposes need no
 * hook and are simply absent here. To add one for a new purpose, write the hook alongside that
 * domain's other operations (see cabin/booking/paymentCompletion.ts for the reference shape) and
 * register it here.
 */
const paymentCompletionHooks: Partial<Record<LedgerTransactionPurpose, PaymentCompletionHook>> = {
    CABIN_BOOKING: cabinBookingPaymentCompletionHook,
}

/**
 * Runs the hook registered for the transaction's purpose, if any. Never throws: a hook is a
 * best-effort side effect on top of a payment that has already succeeded, so a failure here
 * must not make the caller (e.g. the Stripe webhook handler) treat the payment itself as failed
 * or retry indefinitely.
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
                problemDescription: `Fullføringshook for ${transaction.purpose} feilet etter vellykket betaling.`,
                error,
            },
            prisma: context.prisma,
            bypassAuth: true,
        })
    }
}
