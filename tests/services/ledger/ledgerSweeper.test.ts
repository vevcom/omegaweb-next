import { stripe } from '@/lib/stripe'
import { prisma } from '@/prisma-pn-client-instance'
import { stalePendingTransactionMs } from '@/services/ledger/transactions/constants'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { userOperations } from '@/services/users/operations'
import {
    cancelStaleLedgerTransactions,
    flagUnbalancedLedgerTransactions,
    reimburseUnclaimedPayments,
} from '@/services/ledger/sweeper'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const DEPOSIT = 100_00
const STRIPE_FEE = 1_23

let createdIntents = 0

/** Replaces the Stripe calls the payment flows make, as in payments.test.ts. */
function mockStripe() {
    jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(() => {
        createdIntents++
        return Promise.resolve({
            id: `pi_sweeper_${createdIntents}`,
            client_secret: `pi_sweeper_${createdIntents}_secret`,
        } as never)
    })
    const cancelIntent = jest.spyOn(stripe.paymentIntents, 'cancel').mockResolvedValue({} as never)
    const retrieveIntent = jest.spyOn(stripe.paymentIntents, 'retrieve')
    return { cancelIntent, retrieveIntent }
}

let stripeMocks: ReturnType<typeof mockStripe>

beforeEach(() => {
    stripeMocks = mockStripe()
})

afterEach(() => {
    jest.restoreAllMocks()
})

async function createAccount(username: string) {
    const user = await userOperations.create({
        data: {
            email: `${username}@omega.ntnu.no`,
            firstname: 'Test',
            lastname: 'Testesen',
            username,
            emailVerified: new Date().toISOString(),
        },
        bypassAuth: true,
    })
    return ledgerAccountOperations.read({ params: { userId: user.id }, bypassAuth: true })
}

const balanceOf = (ledgerAccountId: number) => ledgerAccountOperations.calculateBalance({
    params: { ledgerAccountId },
    bypassAuth: true,
})

/** A Stripe deposit that has been sent to Stripe and is waiting for the webhook. */
async function startStripeDeposit(ledgerAccountId: number) {
    const transaction = await ledgerMovementOperations.createDeposit({
        params: { ledgerAccountId, provider: 'STRIPE', funds: DEPOSIT },
        bypassAuth: true,
    })
    const paymentId = transaction.payment.id
    const stripePayment = await prisma.stripePayment.findUniqueOrThrow({ where: { paymentId } })
    return { transactionId: transaction.id, paymentId, paymentIntentId: stripePayment.paymentIntentId }
}

/** A SUCCEEDED manual deposit. */
async function createSucceededDeposit(ledgerAccountId: number) {
    const payment = await paymentOperations.create({
        params: { provider: 'MANUAL', funds: DEPOSIT, manualFees: 0 },
        bypassAuth: true,
    })
    return ledgerTransactionOperations.create({
        params: { purpose: 'DEPOSIT', ledgerEntries: [{ ledgerAccountId, funds: DEPOSIT }], paymentId: payment.id },
        bypassAuth: true,
    })
}

const makeStale = (transactionId: number) => prisma.ledgerTransaction.update({
    where: { id: transactionId },
    data: { createdAt: new Date(Date.now() - stalePendingTransactionMs - 1000) },
})

const readTransaction = (id: number) => prisma.ledgerTransaction.findUniqueOrThrow({
    where: { id },
    include: { payment: true },
})

/** The problems the transaction or payment has been flagged for, one per review. */
const flaggedProblems = async (subject: { transactionId: number } | { paymentId: number }) => (
    await prisma.manualTransactionReview.findMany({ where: subject, select: { problem: true } })
).map(review => review.problem)

describe('stale pending transactions', () => {
    test('a stale attempt is canceled along with its payment intent, and a fresh one is left alone', async () => {
        const account = await createAccount('sweeperstale')
        const stale = await startStripeDeposit(account.id)
        const fresh = await startStripeDeposit(account.id)
        await makeStale(stale.transactionId)

        await cancelStaleLedgerTransactions()

        expect(await readTransaction(stale.transactionId)).toMatchObject({
            state: 'CANCELED',
            payment: { state: 'CANCELED' },
        })
        expect(stripeMocks.cancelIntent).toHaveBeenCalledTimes(1)
        expect(stripeMocks.cancelIntent.mock.calls[0][0]).toBe(stale.paymentIntentId)
        expect(await readTransaction(fresh.transactionId)).toMatchObject({ state: 'PENDING' })
    })

    test('a stale attempt whose payment already succeeded is completed, not canceled', async () => {
        const account = await createAccount('sweeperunapplied')
        const { transactionId, paymentId } = await startStripeDeposit(account.id)
        // As if the webhook recorded the payment but died before advancing the transaction.
        await prisma.payment.update({ where: { id: paymentId }, data: { state: 'SUCCEEDED', fees: STRIPE_FEE } })
        await makeStale(transactionId)

        await cancelStaleLedgerTransactions()

        expect(await readTransaction(transactionId)).toMatchObject({ state: 'SUCCEEDED' })
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
        expect(stripeMocks.cancelIntent).not.toHaveBeenCalled()
    })

    test('an attempt Stripe will not cancel is flagged once and left pending', async () => {
        const account = await createAccount('sweeperstuck')
        const { transactionId } = await startStripeDeposit(account.id)
        await makeStale(transactionId)
        stripeMocks.cancelIntent.mockRejectedValue(new Error('Stripe is down'))
        stripeMocks.retrieveIntent.mockResolvedValue({ status: 'requires_payment_method' } as never)

        await cancelStaleLedgerTransactions()
        await cancelStaleLedgerTransactions()

        expect(await readTransaction(transactionId)).toMatchObject({ state: 'PENDING' })
        expect(await flaggedProblems({ transactionId })).toEqual(['STALE_PENDING'])
        // A flagged transaction is left to the admin, so Stripe is not asked again.
        expect(stripeMocks.cancelIntent).toHaveBeenCalledTimes(1)
    })
})

describe('unclaimed payments', () => {
    test('a succeeded payment with no one to reimburse is flagged once', async () => {
        const shop = await createAccount('sweepernopayer')
        const payment = await paymentOperations.create({
            params: { provider: 'STRIPE', funds: DEPOSIT },
            bypassAuth: true,
        })
        // Paid fully through Stripe, so there is no debit entry naming the payer.
        const transaction = await ledgerTransactionOperations.create({
            params: {
                purpose: 'EVENT_PAYMENT',
                ledgerEntries: [{ ledgerAccountId: shop.id, funds: DEPOSIT }],
                paymentId: payment.id,
            },
            bypassAuth: true,
        })
        await prisma.ledgerTransaction.update({ where: { id: transaction.id }, data: { state: 'CANCELED' } })
        await prisma.payment.update({ where: { id: payment.id }, data: { state: 'SUCCEEDED', fees: STRIPE_FEE } })

        await reimburseUnclaimedPayments()
        await reimburseUnclaimedPayments()

        expect(await flaggedProblems({ paymentId: payment.id })).toEqual(['UNCLAIMED_PAYMENT'])
        expect(await prisma.refund.count({ where: { originalTransactionId: transaction.id } })).toBe(0)
    })

    test('a succeeded payment that belongs to no transaction is flagged', async () => {
        const payment = await paymentOperations.create({
            params: { provider: 'STRIPE', funds: DEPOSIT },
            bypassAuth: true,
        })
        await prisma.payment.update({ where: { id: payment.id }, data: { state: 'SUCCEEDED', fees: STRIPE_FEE } })

        await reimburseUnclaimedPayments()

        expect(await flaggedProblems({ paymentId: payment.id })).toEqual(['UNCLAIMED_PAYMENT'])
    })

    test('a manual payment is neither reimbursed nor flagged', async () => {
        const account = await createAccount('sweepermanual')
        const deposit = await createSucceededDeposit(account.id)
        // Left this way by a manual transaction that failed, such as a payout without enough funds.
        await prisma.ledgerTransaction.update({ where: { id: deposit.id }, data: { state: 'FAILED' } })
        await prisma.payment.update({ where: { id: deposit.payment!.id }, data: { claimedByTransactionId: null } })

        await reimburseUnclaimedPayments()

        expect(await flaggedProblems({ paymentId: deposit.payment!.id })).toEqual([])
        expect(await prisma.refund.count({ where: { originalTransactionId: deposit.id } })).toBe(0)
    })
})

describe('unbalanced transactions', () => {
    test('healthy transactions are not flagged', async () => {
        const account = await createAccount('sweeperhealthy')
        const deposit = await createSucceededDeposit(account.id)
        const { transactionId: stripeDeposit, paymentId } = await startStripeDeposit(account.id)
        await prisma.payment.update({ where: { id: paymentId }, data: { state: 'SUCCEEDED', fees: STRIPE_FEE } })
        await ledgerTransactionOperations.advance({ params: { id: stripeDeposit }, bypassAuth: true })

        await flagUnbalancedLedgerTransactions()

        expect(await readTransaction(stripeDeposit)).toMatchObject({ state: 'SUCCEEDED' })
        expect(await flaggedProblems({ transactionId: deposit.id })).toEqual([])
        expect(await flaggedProblems({ transactionId: stripeDeposit })).toEqual([])
    })

    test('a succeeded transaction whose entries no longer add up to its payment is flagged once', async () => {
        const account = await createAccount('sweeperunbalanced')
        const deposit = await createSucceededDeposit(account.id)
        await prisma.ledgerEntry.updateMany({ where: { ledgerTransactionId: deposit.id }, data: { funds: DEPOSIT * 2 } })

        await flagUnbalancedLedgerTransactions()
        await flagUnbalancedLedgerTransactions()

        expect(await flaggedProblems({ transactionId: deposit.id })).toEqual(['UNBALANCED'])
    })

    test('a succeeded transaction whose payment is not claimed by it is flagged', async () => {
        const account = await createAccount('sweeperunclaimed')
        const deposit = await createSucceededDeposit(account.id)
        await prisma.payment.update({ where: { id: deposit.payment!.id }, data: { claimedByTransactionId: null } })

        await flagUnbalancedLedgerTransactions()

        expect(await flaggedProblems({ transactionId: deposit.id })).toEqual(['UNBALANCED'])
    })
})

test('transactions migrated from OmegaWeb Basic are left alone', async () => {
    const account = await createAccount('sweeperlegacy')
    const deposit = await createSucceededDeposit(account.id)
    await prisma.legacyLedgerTransaction.create({
        data: { ledgerTransactionId: deposit.id, source: 'MONEY_MANUAL_DEPOSIT', originalId: 1, data: {} },
    })
    // Unclaimed and unbalanced, as migrated deposits may be.
    await prisma.payment.update({ where: { id: deposit.payment!.id }, data: { claimedByTransactionId: null } })
    await prisma.ledgerEntry.updateMany({ where: { ledgerTransactionId: deposit.id }, data: { funds: DEPOSIT * 2 } })

    await cancelStaleLedgerTransactions()
    await reimburseUnclaimedPayments()
    await flagUnbalancedLedgerTransactions()

    expect(await flaggedProblems({ transactionId: deposit.id })).toEqual([])
    expect(await flaggedProblems({ paymentId: deposit.payment!.id })).toEqual([])
    expect(await prisma.refund.count({ where: { originalTransactionId: deposit.id } })).toBe(0)
})
