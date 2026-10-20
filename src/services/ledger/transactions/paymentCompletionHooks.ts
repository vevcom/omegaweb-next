import '@pn-server-only'
import { manualReviewOperations } from './manualReviews/operations'
import { expandedLedgerTransactionIncluder } from './constants'
import { cabinBookingPaymentCompletionHook } from '@/services/cabin/booking/paymentCompletion'
import { prisma } from '@/prisma-pn-client-instance'
import type { ExpandedLedgerTransaction } from './types'
import type { LedgerTransactionPurpose, Prisma } from '@/prisma-generated-pn-types'
import type { Awaitable } from '@/lib/awaitable'

/**
 * Lets a domain react once a transaction for its purpose has SUCCEEDED, for example by sending a
 * confirmation. The payment completion worker runs it after the success has committed, in a
 * transaction of its own, so a failing hook only rolls back its own changes, never the payment.
 */
export type PaymentCompletionHook = (
    transaction: ExpandedLedgerTransaction,
    context: { prisma: Prisma.TransactionClient },
) => Awaitable<void>

/**
 * Hooks per LedgerTransactionPurpose. Most purposes have none. See
 * cabin/booking/paymentCompletion.ts for an example.
 */
const paymentCompletionHooks: Partial<Record<LedgerTransactionPurpose, PaymentCompletionHook>> = {
    CABIN_BOOKING: cabinBookingPaymentCompletionHook,
}

/** Whether a transaction of this purpose waits for the payment completion worker once it succeeds. */
export function hasPaymentCompletionHook(purpose: LedgerTransactionPurpose) {
    return paymentCompletionHooks[purpose] !== undefined
}

/**
 * Runs the hook that has waited the longest since it was requested. A failing hook is marked as
 * run, flagged for an admin and not retried, so it can't hold up the ones behind it or repeat a
 * side effect like an email.
 *
 * @returns whether a hook was waiting, since more may be.
 */
export async function runNextPaymentCompletionHook(): Promise<boolean> {
    const transaction = await prisma.ledgerTransaction.findFirst({
        where: { completionHookRequestedAt: { not: null }, completionHookRanAt: null },
        include: expandedLedgerTransactionIncluder,
        orderBy: { completionHookRequestedAt: 'asc' },
    })
    if (!transaction) return false

    try {
        await prisma.$transaction(async tx => {
            // Guarded on it not having run yet, so a transaction is never completed twice.
            const { count } = await tx.ledgerTransaction.updateMany({
                where: { id: transaction.id, completionHookRanAt: null },
                data: { completionHookRanAt: new Date() },
            })
            if (count > 0) await paymentCompletionHooks[transaction.purpose]?.(transaction, { prisma: tx })
        })
    } catch (error) {
        // Together, so a failed hook is never marked as run without also being flagged.
        await prisma.$transaction(async tx => {
            await tx.ledgerTransaction.update({
                where: { id: transaction.id },
                data: { completionHookRanAt: new Date() },
            })
            await manualReviewOperations.create({
                params: {
                    transactionId: transaction.id,
                    problem: 'COMPLETION_HOOK_FAILED',
                    problemDescription: `Fullføringshook for ${transaction.purpose} feilet etter vellykket betaling.`,
                    error,
                },
                prisma: tx,
                bypassAuth: true,
            })
        })
    }
    return true
}
