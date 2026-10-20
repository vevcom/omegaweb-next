import '@pn-server-only'
import { stalePendingTransactionMs } from '@/services/ledger/transactions/constants'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { prisma } from '@/prisma-pn-client-instance'
import logger from '@/lib/logger'
import type { ManualReviewProblem } from '@/prisma-generated-pn-types'

// The common failure path of the ledger, run by the ledger worker, so callers don't each handle
// every way a payment can go wrong. Each check fixes one kind of broken state or flags it for an
// admin, at most once per transaction or payment, so a resolved review counts as acknowledged.
// Transactions migrated from OmegaWeb Basic predate these rules and are left alone.

const unclaimedPaymentReason = 'Betalingen gikk gjennom, men transaksjonen den var til ble ikke fullført.'

// How many transactions or payments a check handles per run. Each one is either fixed or flagged,
// so whatever is left over is picked up by the next run.
const batchSize = 50

async function flag(
    subject: { transactionId: number } | { paymentId: number },
    problem: ManualReviewProblem,
    error: unknown,
) {
    await manualReviewOperations.internal.create.internalCall({
        params: { ...subject, problem, error },
    })
}

/**
 * Settles or cancels transactions that have been PENDING for longer than stalePendingTransactionMs,
 * such as an abandoned checkout. Advancing first settles one whose payment already resolved but
 * was never applied, and canceling also cancels the Stripe payment intent.
 */
export async function cancelStaleLedgerTransactions() {
    const stale = await prisma.ledgerTransaction.findMany({
        where: {
            state: 'PENDING',
            createdAt: { lt: new Date(Date.now() - stalePendingTransactionMs) },
            legacy: { is: null },
            manualReviews: { none: { problem: 'STALE_PENDING' } },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: batchSize,
    })

    let canceled = 0
    for (const { id } of stale) {
        try {
            const advanced = await prisma.$transaction(tx => ledgerTransactionOperations.internal.advance.internalCall({
                params: { id },
                prisma: tx,
            }))
            if (advanced.state !== 'PENDING') continue

            await ledgerTransactionOperations.internal.cancel.internalCall({ params: { id } })
            canceled++
        } catch (error) {
            // Failing because it settled in the meantime, e.g. a webhook arriving, is not a problem.
            const { state } = await prisma.ledgerTransaction.findUniqueOrThrow({ where: { id }, select: { state: true } })
            if (state === 'PENDING') await flag({ transactionId: id }, 'STALE_PENDING', error)
        }
    }

    if (canceled > 0) logger.info(`Ledger sweeper canceled ${canceled} stale transaction(s)`)
}

/**
 * Credits the payer back for Stripe payments that succeeded but that no transaction used, for
 * example one that went through after its transaction was canceled or failed. Ones that can't be
 * reimbursed automatically, such as a guest's payment, are flagged. MANUAL payments are skipped,
 * since no money moved outside the ledger for them.
 */
export async function reimburseUnclaimedPayments() {
    const unclaimed = await prisma.payment.findMany({
        where: {
            provider: 'STRIPE',
            state: 'SUCCEEDED',
            claimedByTransactionId: null,
            ledgerTransactions: { every: { state: { not: 'PENDING' }, legacy: { is: null } } },
            manualReviews: { none: { problem: 'UNCLAIMED_PAYMENT' } },
        },
        select: { id: true, ledgerTransactions: { select: { id: true }, orderBy: { id: 'desc' }, take: 1 } },
        orderBy: { id: 'asc' },
        take: batchSize,
    })

    let reimbursed = 0
    for (const payment of unclaimed) {
        try {
            const original = payment.ledgerTransactions.at(0)
            if (!original) throw new Error('Betalingen hører ikke til noen transaksjon.')

            await prisma.$transaction(tx => refundOperations.reimburseUnappliedPayment.internalCall({
                params: { originalTransactionId: original.id, reason: unclaimedPaymentReason },
                prisma: tx,
            }))
            reimbursed++
        } catch (error) {
            await flag({ paymentId: payment.id }, 'UNCLAIMED_PAYMENT', error)
        }
    }

    if (reimbursed > 0) logger.info(`Ledger sweeper reimbursed ${reimbursed} unclaimed payment(s)`)
}

/**
 * Flags SUCCEEDED transactions that break the rules advance() checks before letting them succeed:
 * the entries must add up to the payment in both funds and fees, and the payment must have
 * succeeded and be claimed by the transaction. Finding one means a bug somewhere in the ledger.
 */
export async function flagUnbalancedLedgerTransactions() {
    const unbalanced = await prisma.$queryRaw<{ id: number }[]>`
        SELECT t.id
        FROM "LedgerTransaction" t
        LEFT JOIN "LedgerEntry" e ON e."ledgerTransactionId" = t.id
        LEFT JOIN "Payment" p ON p.id = t."paymentId"
        WHERE t.state = 'SUCCEEDED'
            AND NOT EXISTS (SELECT 1 FROM "LegacyLedgerTransaction" l WHERE l."ledgerTransactionId" = t.id)
            AND NOT EXISTS (
                SELECT 1 FROM "ManualTransactionReview" r
                WHERE r."transactionId" = t.id AND r.problem = 'UNBALANCED'
            )
        GROUP BY t.id, p.id
        HAVING COALESCE(SUM(e.funds), 0) <> COALESCE(p.funds, 0)
            OR BOOL_OR(e.id IS NOT NULL AND e.fees IS NULL)
            OR COALESCE(SUM(e.fees), 0) <> COALESCE(p.fees, 0)
            OR (p.id IS NOT NULL AND (p.state <> 'SUCCEEDED' OR p."claimedByTransactionId" IS DISTINCT FROM t.id))
    `

    for (const { id } of unbalanced) {
        await flag({ transactionId: id }, 'UNBALANCED', undefined)
    }
}
