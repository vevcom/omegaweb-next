import '@pn-server-only'
import { refundAuth } from './auth'
import { refundParamsSchemas } from './schemas'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { RefundType, Prisma } from '@/prisma-generated-pn-types'

/**
 * What `refund` and `reimburseUnappliedPayment` share: post the correcting LedgerTransaction and
 * link it to the original through a Refund row. `Refund.originalTransactionId` is unique, so a
 * second correction attempt for the same original hits a unique-constraint violation here rather
 * than needing its own check-then-act guard.
 */
async function createCorrection(
    { originalTransactionId, reason, type, paymentId, ledgerEntries }: {
        originalTransactionId: number,
        reason: string,
        type: RefundType,
        paymentId?: number,
        ledgerEntries: { ledgerAccountId: number, funds: number }[],
    },
    { prisma }: { prisma: Prisma.TransactionClient },
): Promise<ExpandedLedgerTransaction> {
    const refundTransaction: ExpandedLedgerTransaction = await ledgerTransactionOperations.create({
        params: {
            purpose: 'REFUND',
            ledgerEntries,
            paymentId,
            description: reason,
        },
        prisma,
        bypassAuth: true,
    })

    try {
        await prisma.refund.create({
            data: {
                originalTransactionId,
                refundTransactionId: refundTransaction.id,
                reason,
                type,
            },
        })
    } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new ServiceError('DUPLICATE', 'Denne transaksjonen er allerede korrigert.')
        }
        throw error
    }

    return refundTransaction
}

export const refundOperations = {
    /**
     * Reverses, in full, a transaction that actually SUCCEEDED, so it has posted entries that
     * genuinely need undoing, such as a double-booked cabin reservation or an unregistered paid
     * event. `ledgerEntries` stays an explicit caller-supplied param rather than being derived
     * automatically: the two kinds of callers need genuinely different shapes. Flipping the
     * original entries works when the payer paid from their own ledger balance, but if they paid
     * entirely through Stripe there's no such entry to flip, and the caller has to resolve and
     * credit their account directly instead. There's no single derivation that covers both. This
     * is a pure internal correction with no payment involved, since nothing external needs to
     * move.
     */
    refund: defineOperation({
        authorizer: () => refundAuth.refund,
        paramsSchema: refundParamsSchemas.refund,
        operation: async ({ prisma, params }) => {
            const original = await prisma.ledgerTransaction.findUniqueOrThrow({
                where: { id: params.originalTransactionId },
                select: { state: true },
            })
            if (original.state !== 'SUCCEEDED') {
                throw new ServiceError('BAD PARAMETERS', 'Bare en vellykket transaksjon kan reverseres.')
            }

            return await createCorrection(
                {
                    originalTransactionId: params.originalTransactionId,
                    reason: params.reason,
                    type: 'REVERSAL',
                    ledgerEntries: params.ledgerEntries,
                },
                { prisma },
            )
        },
    }),

    /**
     * Credits the payer back when Stripe captured money that a transaction never actually
     * applied, because it ended FAILED or CANCELED instead of SUCCEEDED. There is nothing to
     * reverse, since the original entries never took effect, only the external capture to
     * compensate for. Reuses the original's own Payment directly rather than fabricating a new
     * one: the correcting transaction's entries sum to exactly that payment's funds, which is
     * what lets it satisfy Kirchhoff's law without a payment of its own.
     * `ledgerTransactionOperations.advance` is what guarantees this payment can't also be
     * claimed by anything else.
     */
    reimburseUnappliedPayment: defineOperation({
        authorizer: () => refundAuth.reimburseUnappliedPayment,
        paramsSchema: refundParamsSchemas.reimburseUnappliedPayment,
        operation: async ({ prisma, params }) => {
            const original = await prisma.ledgerTransaction.findUniqueOrThrow({
                where: { id: params.originalTransactionId },
                select: {
                    state: true,
                    purpose: true,
                    payment: { select: { id: true, funds: true, provider: true } },
                    ledgerEntries: { select: { ledgerAccountId: true, funds: true } },
                },
            })

            if (original.state !== 'FAILED' && original.state !== 'CANCELED') {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Bare en mislykket eller kansellert transaksjon kan tilbakebetales på denne måten.'
                )
            }
            // Only STRIPE payments can have moved real external money independently of our own
            // state. A MANUAL payment is never captured by anything but this system, so nothing
            // needs reimbursing for one regardless of what its Payment.state says.
            if (original.payment?.provider !== 'STRIPE') {
                throw new ServiceError('BAD PARAMETERS', 'Det finnes ingen Stripe-betaling å tilbakebetale.')
            }
            // Not gated on payment.state === 'SUCCEEDED': the exact case this exists for is a
            // payment our own database still shows as CANCELED/FAILED, because Stripe's success
            // event arrived too late for the guarded update in stripeWebhookCallback.ts to apply
            // it, so our own state is precisely what's stale here. Callers only reach this once
            // they've independently established the capture, from the incoming Stripe event
            // itself rather than from this row. Correct that stale state now: the correction
            // transaction below reuses this same payment, and determineTransactionState's
            // noFailedPayment rule would otherwise fail it too, for the very same stale reason.
            await prisma.payment.update({
                where: { id: original.payment.id },
                data: {
                    state: 'SUCCEEDED',
                    ...params.fees !== undefined && { fees: params.fees },
                },
            })

            // A deposit has a single entry crediting the depositor's own account, which is the
            // payer regardless of its sign. Every other purpose only has a distinct payer entry,
            // the debit side, when part of the price came from the payer's own balance; if the
            // whole price went through Stripe, there's no ledger entry for the payer at all, and
            // this falls through to the error below.
            const payerEntry = original.purpose === 'DEPOSIT'
                ? original.ledgerEntries[0]
                : original.ledgerEntries.find(entry => entry.funds < 0)
            if (!payerEntry) {
                throw new ServiceError('SERVER ERROR', 'Fant ingen betaler å tilbakebetale til.')
            }

            return await createCorrection(
                {
                    originalTransactionId: params.originalTransactionId,
                    reason: params.reason,
                    type: 'REIMBURSEMENT',
                    paymentId: original.payment.id,
                    ledgerEntries: [{ ledgerAccountId: payerEntry.ledgerAccountId, funds: original.payment.funds }],
                },
                { prisma },
            )
        },
    }),
} as const
