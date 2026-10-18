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
     * Reverses, in full, a transaction that actually SUCCEEDED, so it has posted entries that
     * genuinely need undoing, such as a double-booked cabin reservation or an unregistered paid
     * event. Negates the original's own entries - a pure internal correction with no payment
     * involved, since nothing external needs to move. That alone only balances to zero when the
     * original's entries already did, which isn't the case whenever some of the money came in
     * through Stripe rather than from a payer's own ledger balance: `refundTo` then names the
     * account(s) the rest goes to instead. Naming an account that already got a negated entry
     * replaces it rather than adding to it, which is also what makes a mixed balance-and-Stripe
     * payment resolve correctly - the payer's one entry is replaced with the full amount they're
     * owed, not left at just their own balance portion.
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

            // The schema guarantees at most one refundTo entry can omit funds, and only when
            // it's the only one listed - so there's at most one pending entry to carry past this
            // loop. Naming an account that already held a negated entry of its own replaces it
            // rather than adding to it, which is what lets the pending case also cover an
            // account's full share of a payment split between its own balance and Stripe.
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
} as const

/**
 * Posts the correcting LedgerTransaction and links it to the original through a Refund row.
 * `Refund.originalTransactionId` is unique, so a second correction attempt for the same original
 * hits a unique-constraint violation here rather than needing its own check-then-act guard.
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
