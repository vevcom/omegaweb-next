import { prisma } from '@/prisma/client'
import { runPaymentCompletionHook } from '@/services/ledger/transactions/paymentCompletionHooks'
import { describe, expect, test } from '@jest/globals'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

describe('runPaymentCompletionHook', () => {
    test(
        'a hook failure records its manual review through the ambient transaction, '
        + 'not a separate connection that would have to wait on it to commit',
        async () => {
            const review = await prisma.$transaction(async tx => {
                const transaction = await tx.ledgerTransaction.create({
                    data: { purpose: 'CABIN_BOOKING', state: 'SUCCEEDED' },
                })

                // bookingId names no real booking, so the registered CABIN_BOOKING hook's own
                // first lookup throws - the exact kind of failure this exercises, without needing
                // a full cabin booking setup.
                await runPaymentCompletionHook(
                    { ...transaction, bookingId: 999_999_999 } as unknown as ExpandedLedgerTransaction,
                    { prisma: tx }
                )

                // Read through the still-open transaction; a separate connection would block until it commits.
                return tx.manualTransactionReview.findFirst({ where: { transactionId: transaction.id } })
            })

            expect(review).toMatchObject({
                problem: 'COMPLETION_HOOK_FAILED',
                problemDescription: expect.stringContaining('CABIN_BOOKING'),
            })
        }
    )
})
