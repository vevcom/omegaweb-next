import { cabinBookingPaymentCompletionHook } from '@/services/cabin/booking/paymentCompletion'
import logger from '@/lib/logger'
import type { ExpandedLedgerTransaction } from './types'
import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'

/**
 * Lets a domain react once a transaction for its purpose reaches SUCCEEDED (e.g. send a
 * confirmation). It can only fail its own side effects, never the payment. `prisma` is the
 * client ambient in the advance() call that triggered it.
 */
export type PaymentCompletionHook = (
    transaction: ExpandedLedgerTransaction,
    context: { prisma: Prisma.TransactionClient },
) => Promise<void>

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
        // TODO: Will be fixed by a ledger worker/sweeper (not yet built) - it'll run this hook
        // standalone, after advance()'s own transaction instead of nested inside it, and record
        // a proper ManualTransactionReview without this path's transactional complexity (a DB
        // failure here can abort the connection and silently roll back the whole transaction).
        logger.error(
            `MANUAL ADMIN ACTION REQUIRED! Fullføringshook for ${transaction.purpose} feilet etter `
            + `vellykket betaling (transaksjon ${transaction.id}).`,
            { error }
        )
    }
}
