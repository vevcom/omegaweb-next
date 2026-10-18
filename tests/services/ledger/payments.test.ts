import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/prisma-pn-client-instance'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { stripeWebhookCallback } from '@/services/ledger/payments/stripeWebhookCallback'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { userOperations } from '@/services/users/operations'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import type Stripe from 'stripe'

const DEPOSIT = 100_00
const STRIPE_FEE = 1_23

let createdIntents = 0

/** What `stripe.charges.list` pages through for a payment intent: one charge, with its fee expanded. */
async function* chargesWithStripeFee() {
    yield { id: 'ch_test', balance_transaction: { fee: STRIPE_FEE } }
}

/**
 * Replaces the Stripe calls the payment flows make, so no test ever reaches Stripe.
 *
 * The services hold on to the one Stripe client, which tests/setup.ts has already loaded through
 * the seeder by the time this file runs - so jest.mock cannot swap the module out. The methods are
 * replaced on the client itself instead.
 */
function mockStripe() {
    const createIntent = jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(async () => {
        createdIntents++
        return {
            id: `pi_test_${createdIntents}`,
            client_secret: `pi_test_${createdIntents}_secret`,
        } as never
    })
    const cancelIntent = jest.spyOn(stripe.paymentIntents, 'cancel').mockResolvedValue({} as never)
    const retrieveIntent = jest.spyOn(stripe.paymentIntents, 'retrieve')
    jest.spyOn(stripe.charges, 'list').mockImplementation(() => chargesWithStripeFee() as never)

    return { createIntent, cancelIntent, retrieveIntent }
}

let stripeMocks: ReturnType<typeof mockStripe>

beforeEach(() => {
    stripeMocks = mockStripe()
})

afterEach(() => {
    jest.restoreAllMocks()
})

const stripeEvent = (type: Stripe.Event['type'], paymentIntentId: string) => ({
    type,
    data: { object: { id: paymentIntentId } },
}) as unknown as Stripe.Event

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
    const stripePayment = transaction.payment
        ? await prisma.stripePayment.findUnique({ where: { paymentId: transaction.payment.id } })
        : null
    const paymentIntentId = stripePayment?.paymentIntentId
    if (!paymentIntentId) throw new Error('The deposit was not sent to Stripe.')

    return { transactionId: transaction.id, paymentIntentId }
}

const readTransaction = (id: number) => prisma.ledgerTransaction.findUniqueOrThrow({
    where: { id },
    include: { payment: true },
})

/**
 * A SUCCEEDED transfer between two ledger accounts, no payment involved - the shape
 * reverseTransaction actually reverses in production (a purchase/booking/payment, destination
 * credited and payer debited). `fromAccountId` must already hold at least `funds`.
 */
async function createSucceededTransfer(fromAccountId: number, toAccountId: number, funds: number) {
    return ledgerTransactionOperations.create({
        params: {
            purpose: 'CABIN_BOOKING',
            ledgerEntries: [
                { ledgerAccountId: toAccountId, funds },
                { ledgerAccountId: fromAccountId, funds: -funds },
            ],
        },
        bypassAuth: true,
    })
}

/** A SUCCEEDED manual deposit, with nothing refunded against it yet. */
async function createSucceededDeposit(ledgerAccountId: number, funds: number) {
    const payment = await paymentOperations.create({
        params: { provider: 'MANUAL', funds, manualFees: 0 },
        bypassAuth: true,
    })
    return ledgerTransactionOperations.create({
        params: {
            purpose: 'DEPOSIT',
            ledgerEntries: [{ ledgerAccountId, funds }],
            paymentId: payment.id,
        },
        bypassAuth: true,
    })
}

describe('creating payments', () => {
    test('a manual payment succeeds at once with the given fees, and is never sent to Stripe', async () => {
        const payment = await paymentOperations.create({
            params: { provider: 'MANUAL', funds: DEPOSIT, manualFees: 5_00 },
            bypassAuth: true,
        })

        expect(payment).toMatchObject({ state: 'SUCCEEDED', funds: DEPOSIT, fees: 5_00 })
        expect(payment.manualPayment).not.toBeNull()

        await expect(paymentOperations.initiate({ params: { paymentId: payment.id }, bypassAuth: true }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(stripeMocks.createIntent).not.toHaveBeenCalled()
    })

    test('a manual payment takes LEDGER_ADMIN', async () => {
        const before = await prisma.payment.count()

        await expect(paymentOperations.create({
            params: { provider: 'MANUAL', funds: DEPOSIT, manualFees: 0 },
            session: Session.fromJsObject({ user: null, permissions: ['LEDGER_USE'], memberships: [] }),
        })).rejects.toThrow(Smorekopp)

        expect(await prisma.payment.count()).toBe(before)
    })

    test('a Stripe payment waits until it is initiated, and is then sent to Stripe once', async () => {
        const payment = await paymentOperations.create({
            params: { provider: 'STRIPE', funds: DEPOSIT, descriptionLong: 'Innskudd', descriptionShort: 'Innskudd' },
            bypassAuth: true,
        })
        expect(payment.state).toBe('PENDING')
        expect(stripeMocks.createIntent).not.toHaveBeenCalled()

        const initiated = await paymentOperations.initiate({ params: { paymentId: payment.id }, bypassAuth: true })

        expect(initiated.state).toBe('PROCESSING')
        expect(initiated.stripePayment).toMatchObject({
            paymentIntentId: expect.stringMatching(/^pi_test_/),
            clientSecret: expect.stringMatching(/_secret$/),
        })
        expect(stripeMocks.createIntent).toHaveBeenCalledTimes(1)
        expect(stripeMocks.createIntent.mock.calls[0][0]).toMatchObject({ amount: DEPOSIT, currency: 'nok' })

        await expect(paymentOperations.initiate({ params: { paymentId: payment.id }, bypassAuth: true }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
        expect(stripeMocks.createIntent).toHaveBeenCalledTimes(1)
    })

    test('an initiation that a cancel got ahead of cancels the intent it made', async () => {
        const payment = await paymentOperations.create({
            params: { provider: 'STRIPE', funds: DEPOSIT },
            bypassAuth: true,
        })
        stripeMocks.createIntent.mockImplementationOnce(async () => {
            await paymentOperations.cancel({ params: { paymentId: payment.id }, bypassAuth: true })
            return { id: 'pi_test_raced', client_secret: 'pi_test_raced_secret' } as never
        })

        await expect(paymentOperations.initiate({ params: { paymentId: payment.id }, bypassAuth: true }))
            .rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { stripePayment: true } }))
            .toMatchObject({ state: 'CANCELED', stripePayment: { paymentIntentId: null } })
        expect(stripeMocks.cancelIntent).toHaveBeenCalledTimes(1)
        expect(stripeMocks.cancelIntent.mock.calls[0][0]).toBe('pi_test_raced')
    })
})

describe('creating deposits', () => {
    test('if sending the deposit to Stripe fails, the stuck attempt is canceled instead of left behind', async () => {
        const account = await createAccount('depositinitiatefails')
        stripeMocks.createIntent.mockRejectedValueOnce(new Error('Stripe is down'))

        await expect(ledgerMovementOperations.createDeposit({
            params: { ledgerAccountId: account.id, provider: 'STRIPE', funds: DEPOSIT },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('UNKNOWN ERROR'))

        const [transaction] = await prisma.ledgerTransaction.findMany({
            where: { ledgerEntries: { some: { ledgerAccountId: account.id } } },
        })
        expect(transaction.state).toBe('CANCELED')
    })
})

describe('canceling payments', () => {
    const cancelTransaction = (id: number) => ledgerTransactionOperations.cancel({ params: { id }, bypassAuth: true })

    test('canceling a pending deposit cancels its payment intent', async () => {
        const account = await createAccount('stripecancel')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        await cancelTransaction(transactionId)

        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'CANCELED',
            payment: { state: 'CANCELED' },
        })
        expect(stripeMocks.cancelIntent.mock.calls[0][0]).toBe(paymentIntentId)
    })

    test('an intent Stripe has already canceled is written off here too', async () => {
        const account = await createAccount('stripecanceledbefore')
        const { transactionId } = await startStripeDeposit(account.id)
        stripeMocks.cancelIntent.mockRejectedValueOnce(new Error('Intent is already canceled'))
        stripeMocks.retrieveIntent.mockResolvedValueOnce({ status: 'canceled' } as never)

        await cancelTransaction(transactionId)

        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'CANCELED',
            payment: { state: 'CANCELED' },
        })
    })

    test('an intent Stripe would not cancel keeps its payment open', async () => {
        const account = await createAccount('stripecancelfailed')
        const { transactionId } = await startStripeDeposit(account.id)
        stripeMocks.cancelIntent.mockRejectedValueOnce(new Error('Stripe is down'))
        stripeMocks.retrieveIntent.mockResolvedValueOnce({ status: 'requires_payment_method' } as never)

        await expect(cancelTransaction(transactionId)).rejects.toThrow(new Smorekopp('SERVER ERROR'))

        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'PENDING',
            payment: { state: 'PROCESSING' },
        })
    })

    test('an intent that succeeded before its webhook arrived cannot be canceled', async () => {
        const account = await createAccount('stripecancelsucceeded')
        const { transactionId } = await startStripeDeposit(account.id)
        stripeMocks.cancelIntent.mockRejectedValueOnce(new Error('Intent has already succeeded'))
        stripeMocks.retrieveIntent.mockResolvedValueOnce({ status: 'succeeded' } as never)

        await expect(cancelTransaction(transactionId)).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'PENDING',
            payment: { state: 'PROCESSING' },
        })
    })
})

describe('canceling a transaction is restricted to its debited side', () => {
    const sessionOf = (userId: number) => Session.fromJsObject({
        user: { id: userId } as NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>,
        permissions: [],
        memberships: [],
    })

    test('the credited side cannot cancel the debited side\'s pending attempt, but the debited side can', async () => {
        const payer = await createAccount('cancelauthpayer')
        const receiver = await createAccount('cancelauthreceiver')

        const pending = await prisma.ledgerTransaction.create({
            data: {
                purpose: 'CABIN_BOOKING',
                state: 'PENDING',
                ledgerEntries: {
                    create: [
                        { ledgerAccountId: receiver.id, funds: 50_00 },
                        { ledgerAccountId: payer.id, funds: -50_00 },
                    ],
                },
            },
        })

        await expect(ledgerTransactionOperations.cancel({
            params: { id: pending.id },
            session: sessionOf(receiver.ownership.userId!),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(ledgerTransactionOperations.cancel({
            params: { id: pending.id },
            session: sessionOf(payer.ownership.userId!),
        })).resolves.toMatchObject({ state: 'CANCELED' })
    })

    test('a depositor may still cancel their own stuck deposit, which has no debited side at all', async () => {
        const account = await createAccount('cancelauthdepositor')
        const { transactionId } = await startStripeDeposit(account.id)

        await expect(ledgerTransactionOperations.cancel({
            params: { id: transactionId },
            session: sessionOf(account.ownership.userId!),
        })).resolves.toMatchObject({ state: 'CANCELED' })
    })
})

describe('the Stripe webhook', () => {
    test('nothing is credited before Stripe reports the payment as succeeded', async () => {
        const account = await createAccount('stripewaiting')
        const { transactionId } = await startStripeDeposit(account.id)

        expect(await readTransaction(transactionId)).toMatchObject({ state: 'PENDING' })
        expect(await balanceOf(account.id)).toEqual({ amount: 0, fees: 0 })
    })

    test('a succeeded payment credits the account, with the fees Stripe took', async () => {
        const account = await createAccount('stripesucceeded')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        const response = await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'SUCCEEDED',
            payment: { state: 'SUCCEEDED', fees: STRIPE_FEE },
        })
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
    })

    test('a succeeded event delivered twice only credits the account once', async () => {
        const account = await createAccount('stripeduplicate')
        const { paymentIntentId } = await startStripeDeposit(account.id)

        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))
        const response = await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
    })

    test('a failed payment fails the deposit, credits nothing and cancels the payment intent', async () => {
        const account = await createAccount('stripefailed')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        const response = await stripeWebhookCallback(stripeEvent('payment_intent.payment_failed', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'FAILED',
            payment: { state: 'FAILED' },
        })
        expect(await balanceOf(account.id)).toEqual({ amount: 0, fees: 0 })
        expect(stripeMocks.cancelIntent).toHaveBeenCalledTimes(1)
        expect(stripeMocks.cancelIntent.mock.calls[0][0]).toBe(paymentIntentId)
    })

    test('a failed event cannot undo a payment that has already succeeded', async () => {
        const account = await createAccount('stripefailedlate')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))
        const response = await stripeWebhookCallback(stripeEvent('payment_intent.payment_failed', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'SUCCEEDED',
            payment: { state: 'SUCCEEDED' },
        })
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
    })

    test('an event type that is not handled is acknowledged and changes nothing', async () => {
        const account = await createAccount('stripeunhandled')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        const response = await stripeWebhookCallback(stripeEvent('payment_intent.created', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'PENDING',
            payment: { state: 'PROCESSING' },
        })
        expect(await balanceOf(account.id)).toEqual({ amount: 0, fees: 0 })
    })
})

describe('reversing transactions', () => {
    test('a reversal flips the full transaction, with no accounts to name', async () => {
        const payer = await createAccount('reversefullpayer')
        const destination = await createAccount('reversefulldest')
        await createSucceededDeposit(payer.id, DEPOSIT)
        const transaction = await createSucceededTransfer(payer.id, destination.id, DEPOSIT)

        const reversalTransaction = await refundOperations.reverseTransaction({
            params: { originalTransactionId: transaction.id, reason: 'full reversal' },
            bypassAuth: true,
        })

        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
        expect(await balanceOf(destination.id)).toEqual({ amount: 0, fees: 0 })
        expect(await prisma.refund.findUnique({ where: { originalTransactionId: transaction.id } }))
            .toMatchObject({ type: 'REVERSAL', refundTransactionId: reversalTransaction.id })
    })

    test('a transaction may only be reversed once', async () => {
        const payer = await createAccount('reversetwicepayer')
        const destination = await createAccount('reversetwicedest')
        await createSucceededDeposit(payer.id, DEPOSIT)
        // Padding so the destination still has enough balance for a second (duplicate) reversal
        // attempt's debit to pass the balance check and reach the real guard this test is about:
        // Refund.originalTransactionId's uniqueness.
        await createSucceededDeposit(destination.id, DEPOSIT)
        const transaction = await createSucceededTransfer(payer.id, destination.id, DEPOSIT)

        // Wrapped in its own transaction, the same way every real caller does it -
        // reverseTransaction posts its correction and its Refund row as two separate statements,
        // so without this a duplicate attempt could commit the correction before failing on the
        // Refund row's unique constraint, reversing the balance twice while still throwing
        // DUPLICATE.
        await prisma.$transaction(tx => refundOperations.reverseTransaction({
            params: { originalTransactionId: transaction.id, reason: 'first attempt' },
            prisma: tx,
            bypassAuth: true,
        }))

        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
        expect(await balanceOf(destination.id)).toEqual({ amount: DEPOSIT, fees: 0 })

        await expect(prisma.$transaction(tx => refundOperations.reverseTransaction({
            params: { originalTransactionId: transaction.id, reason: 'second attempt' },
            prisma: tx,
            bypassAuth: true,
        }))).rejects.toThrow(new Smorekopp('DUPLICATE'))

        expect(await prisma.refund.count({ where: { originalTransactionId: transaction.id } })).toBe(1)
        // The duplicate attempt's own correction must not have been left committed despite the
        // throw - balances stay exactly where the first, successful reversal left them.
        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
        expect(await balanceOf(destination.id)).toEqual({ amount: DEPOSIT, fees: 0 })
    })

    test('only a SUCCEEDED transaction can be reversed this way', async () => {
        const account = await createAccount('reversewrongstate')
        const payment = await paymentOperations.create({
            params: { provider: 'STRIPE', funds: DEPOSIT },
            bypassAuth: true,
        })
        const transaction = await ledgerTransactionOperations.create({
            params: {
                purpose: 'DEPOSIT',
                ledgerEntries: [{ ledgerAccountId: account.id, funds: DEPOSIT }],
                paymentId: payment.id,
            },
            bypassAuth: true,
        })
        expect(transaction.state).toBe('PENDING')

        await expect(refundOperations.reverseTransaction({
            params: { originalTransactionId: transaction.id, reason: 'not succeeded yet' },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('flipping alone fails when the original was funded by an outside payment', async () => {
        const committee = await createAccount('reversenoaccountcommittee')
        // A single-entry transaction, same shape as a cabin/event payment made entirely through
        // Stripe: there's no entry for a payer to flip back, since the money never touched a
        // ledger balance on its way in.
        const transaction = await createSucceededDeposit(committee.id, DEPOSIT)

        await expect(refundOperations.reverseTransaction({
            params: { originalTransactionId: transaction.id, reason: 'no account named' },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('naming the one account to refund resolves the rest automatically', async () => {
        const committee = await createAccount('reverseoneaccountcommittee')
        const payer = await createAccount('reverseoneaccountpayer')
        const transaction = await createSucceededDeposit(committee.id, DEPOSIT)

        await refundOperations.reverseTransaction({
            params: {
                originalTransactionId: transaction.id,
                reason: 'paid entirely through Stripe',
                refundTo: [{ ledgerAccountId: payer.id }],
            },
            bypassAuth: true,
        })

        expect(await balanceOf(committee.id)).toEqual({ amount: 0, fees: 0 })
        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
    })

    test('naming an account the flip already touched overwrites its amount instead of adding to it', async () => {
        const committee = await createAccount('reverseoverwritecommittee')
        const payer = await createAccount('reverseoverwritepayer')
        await createSucceededDeposit(payer.id, 40_00)
        // Mirrors a real mixed payment: 40 of the 100 came from the payer's own balance, the
        // other 60 through Stripe, so the payer's own entry only covers part of the price.
        const shortfallPayment = await paymentOperations.create({
            params: { provider: 'MANUAL', funds: 60_00, manualFees: 0 },
            bypassAuth: true,
        })
        const transaction = await ledgerTransactionOperations.create({
            params: {
                purpose: 'CABIN_BOOKING',
                ledgerEntries: [
                    { ledgerAccountId: committee.id, funds: DEPOSIT },
                    { ledgerAccountId: payer.id, funds: -40_00 },
                ],
                paymentId: shortfallPayment.id,
            },
            bypassAuth: true,
        })

        await refundOperations.reverseTransaction({
            params: {
                originalTransactionId: transaction.id,
                reason: 'double-booked after a mixed payment',
                refundTo: [{ ledgerAccountId: payer.id, funds: DEPOSIT }],
            },
            bypassAuth: true,
        })

        // The payer is owed the full price back, not just their own 40 balance portion plus the
        // named 100 - that would be the "add" behavior this test rules out.
        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
        expect(await balanceOf(committee.id)).toEqual({ amount: 0, fees: 0 })
    })
})
