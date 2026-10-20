import { prisma } from '@/prisma/client'
import logger from '@/lib/logger'
import { runPaymentCompletionHook } from '@/services/ledger/transactions/paymentCompletionHooks'
import { describe, expect, jest, test } from '@jest/globals'
import type { ExpandedLedgerTransaction } from '@/services/ledger/transactions/types'

describe('runPaymentCompletionHook', () => {
    test('a hook failure is logged for manual action instead of thrown', async () => {
        const transaction = await prisma.ledgerTransaction.create({
            data: { purpose: 'CABIN_BOOKING', state: 'SUCCEEDED' },
        })
        const errorSpy = jest.spyOn(logger, 'error')

        // bookingId names no real booking, so the registered CABIN_BOOKING hook's own first
        // lookup throws without needing a full cabin booking setup.
        await expect(runPaymentCompletionHook(
            { ...transaction, bookingId: 999_999_999 } as unknown as ExpandedLedgerTransaction,
            { prisma }
        )).resolves.toBeUndefined()

        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('MANUAL ADMIN ACTION REQUIRED'),
            expect.anything()
        )
        errorSpy.mockRestore()
    })
})
