import logger from '@/lib/logger'
import { prisma as defaultPrisma } from '@/prisma/client'
import type { Prisma } from '@/prisma-generated-pn-types'

/**
 * Logs "MANUAL ADMIN ACTION REQUIRED!" and records a `ManualTransactionReview` row for a
 * transaction that needs a human to resolve something this codebase has no automated way to
 * find or fix on its own. Never throws itself, even if the write fails - every caller is already
 * in a best-effort path (a payment hook, a webhook handler) that must not fail because of this.
 *
 * Defaults to the top-level `prisma` client. Pass the ambient transaction client instead when
 * the review should commit together with other writes already happening in it.
 */
export async function createManualReview(
    transactionId: number,
    problemDescription: string,
    { prisma = defaultPrisma, error }: { prisma?: Prisma.TransactionClient, error?: unknown } = {}
): Promise<void> {
    logger.error(`MANUAL ADMIN ACTION REQUIRED! ${problemDescription} (transaksjon ${transactionId})`, error && { error })
    try {
        await prisma.manualTransactionReview.create({ data: { transactionId, problemDescription } })
    } catch (reviewError) {
        logger.error(
            `MANUAL ADMIN ACTION REQUIRED! Could not record a manual review for transaction ${transactionId}.`,
            { reviewError }
        )
    }
}
