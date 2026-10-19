import '@pn-server-only'
import { refundAuth } from './auth'
import { refundParamsSchemas } from './schemas'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { ServiceError } from '@/services/error'
import { defineOperation } from '@/services/serviceOperation'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'
import type { RefundType, Prisma } from '@/prisma-generated-pn-types'

export const refundOperations = {
    /**
     * Reverses a SUCCEEDED transaction in full by negating its entries. When part of the money came
     * through Stripe that doesn't balance, so `refundTo` names the account(s) that get the rest.
     */
    reverseTransaction: defineOperation({
        authorizer: () => refundAuth.reverseTransaction,
        paramsSchema: refundParamsSchemas.reverseTransaction,
        operation: async ({ prisma, params }) => {
            const original = await prisma.ledgerTransaction.findUniqueOrThrow({
                where: { id: params.originalTransactionId },
                select: {
                    state: true,
                    ledgerEntries: { select: { ledgerAccountId: true, funds: true } },
                },
            })
            if (original.state !== 'SUCCEEDED') {
                throw new ServiceError('BAD PARAMETERS', 'Bare en vellykket transaksjon kan reverseres.')
            }

            const entries = new Map(original.ledgerEntries.map(entry => [entry.ledgerAccountId, -entry.funds]))

            // A refundTo entry replaces the account's negated entry. The schema allows at most one
            // entry without funds, which gets the remainder.
            let pendingEntry: { ledgerAccountId: number } | undefined
            for (const refundEntry of params.refundTo ?? []) {
                if (refundEntry.funds === undefined) pendingEntry = refundEntry
                else entries.set(refundEntry.ledgerAccountId, refundEntry.funds)
            }
            if (pendingEntry) {
                entries.delete(pendingEntry.ledgerAccountId)
                const remainder = -Array.from(entries.values()).reduce((sum, funds) => sum + funds, 0)
                entries.set(pendingEntry.ledgerAccountId, remainder)
            }

            const ledgerEntries = Array.from(entries, ([ledgerAccountId, funds]) => ({ ledgerAccountId, funds }))
            if (ledgerEntries.reduce((sum, entry) => sum + entry.funds, 0) !== 0) {
                throw new ServiceError(
                    'BAD PARAMETERS',
                    'Beløpet går ikke opp ved å bare bytte fortegn - oppgi hvilken konto resten skal krediteres.'
                )
            }

            return await createCorrection(
                {
                    originalTransactionId: params.originalTransactionId,
                    reason: params.reason,
                    type: 'REVERSAL',
                    ledgerEntries,
                },
                { prisma },
            )
        },
    }),

    /**
     * Credits the payer back when Stripe captured money for a transaction that ended FAILED or
     * CANCELED. Reuses the original's Payment, so the correction balances without a new one.
     * advance() guarantees nothing else can claim that payment.
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
                    payment: { select: { id: true, funds: true, provider: true, state: true } },
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
            if (original.payment.state !== 'SUCCEEDED') {
                throw new ServiceError('BAD PARAMETERS', 'Betalingen har ikke gått gjennom.')
            }
            // A deposit's single entry is the payer's. Otherwise the payer only has an entry (the debit) if
            // part of the price came from their balance; if not, this errors below.
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

/**
 * Posts the correcting transaction and links it to the original with a Refund row.
 * `Refund.originalTransactionId` is unique, so a second correction fails here.
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
