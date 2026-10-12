import { allSettledOrThrow } from 'tests/utils'
import { prisma } from '@/prisma/client'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { userOperations } from '@/services/users/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { beforeAll, beforeEach, afterEach, describe, expect, test } from '@jest/globals'

const TEST_ACCOUNT_COUNT = 3
const INITIAL_BALANCE = { amount: 100_00, fees: 10_00 }

describe('ledger transactions', () => {
    const testAccountIds: number[] = []

    // Set up ledger accounts
    beforeAll(async () => {
        // TODO: Create utility to create test accounts
        await allSettledOrThrow(Array.from({ length: TEST_ACCOUNT_COUNT }).map(async (_, i) => {
            const username = `testuser${i + 1}`

            const testUser = await userOperations.create({
                data: {
                    email: `${username}@example.com`,
                    firstname: 'Test',
                    lastname: 'User',
                    username,
                },
                bypassAuth: true,
            })

            // userOperations.create already gave the user a ledger account - just read it.
            const testAccount = await ledgerAccountOperations.read({
                params: { userId: testUser.id },
                bypassAuth: true,
            })

            testAccountIds.push(testAccount.id)
        }))
    })

    afterEach(async () => {
        await prisma.ledgerEntry.deleteMany({})
        await prisma.ledgerTransaction.deleteMany({})
    })

    describe('external transactions', () => {

    })

    describe('internal transactions', () => {
        beforeEach(async () => {
            await allSettledOrThrow(testAccountIds.map(async accountId => {
                const manualPayment = await paymentOperations.create({
                    params: {
                        funds: INITIAL_BALANCE.amount,
                        provider: 'MANUAL',
                        manualFees: INITIAL_BALANCE.fees,
                    },
                    bypassAuth: true,
                })

                await ledgerTransactionOperations.create({
                    params: {
                        purpose: 'DEPOSIT',
                        ledgerEntries: [{
                            ledgerAccountId: accountId,
                            funds: INITIAL_BALANCE.amount,
                        }],
                        paymentId: manualPayment.id,
                    },
                    bypassAuth: true,
                })
            })
            )
        })

        const validLedgerEntries: number[][] = [
            // No entries
            [],
            // Transfer between two accounts
            [100_00, -100_00],
            // Transfer between three accounts - two debits and one credit
            [100_00, -50_00, -50_00],
            // Transfer between three accounts - two credits and one debit
            [-100_00, 50_00, 50_00],
        ]

        test.each(validLedgerEntries)('valid internal transactions', async (...entries) => {
            const transaction = await ledgerTransactionOperations.create({
                params: {
                    ledgerEntries: entries.map((funds, i) => ({ funds, ledgerAccountId: testAccountIds[i] })),
                    purpose: 'DEPOSIT',
                },
                bypassAuth: true,
            })

            expect(transaction).toMatchObject({
                state: 'SUCCEEDED',
            })

            const balances = await ledgerAccountOperations.calculateBalances({
                params: { ledgerAccountIds: testAccountIds },
                bypassAuth: true,
            })

            entries.forEach((amount, i) => {
                const accountId = testAccountIds[i]
                const balance = balances[accountId]

                expect(balance.amount).toBe(INITIAL_BALANCE.amount + amount)
            })
        })

        const invalidLedgerEntries: number[][] = [
            // Only one entry
            [100],
            [-100],
            // Non-zero sum
            [100_00, -99_00],
            [-1919, 1000_00],
            [100_00, -50_00, -50_01],
        ]

        test.each(invalidLedgerEntries)('invalid internal transactions', async (...entries) => {
            const transactionPromise = ledgerTransactionOperations.create({
                params: {
                    ledgerEntries: entries.map((funds, i) => ({ funds, ledgerAccountId: testAccountIds[i] })),
                    purpose: 'DEPOSIT',
                },
                bypassAuth: true,
            })

            await expect(transactionPromise).rejects.toThrow()

            const balances = await ledgerAccountOperations.calculateBalances({
                params: { ledgerAccountIds: testAccountIds },
                bypassAuth: true,
            })

            testAccountIds.forEach(accountId => {
                const balance = balances[accountId]

                expect(balance.amount).toBe(INITIAL_BALANCE.amount)
            })
        })
    })
})
