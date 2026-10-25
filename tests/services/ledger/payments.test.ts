import { Session } from '@/auth/session/Session'
import { Smorekopp } from '@/services/error'
import { stripe } from '@/lib/stripe'
import logger from '@/lib/logger'
import { prisma } from '@/prisma-pn-client-instance'
import { paymentOperations } from '@/services/ledger/payments/operations'
import { stripeWebhookCallback } from '@/services/ledger/payments/stripeWebhookCallback'
import { ledgerAccountOperations } from '@/services/ledger/accounts/operations'
import { ledgerMovementOperations } from '@/services/ledger/movements/operations'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { manualReviewOperations } from '@/services/ledger/transactions/manualReviews/operations'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { reimburseUnclaimedPayments } from '@/services/ledger/sweeper'
import { userOperations } from '@/services/users/operations'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import Stripe from 'stripe'
import type { Permission } from '@/prisma-generated-pn-types'

const DEPOSIT = 100_00
const STRIPE_FEE = 1_23

let createdIntents = 0

/**
 * Replaces the Stripe calls the payment flows make. tests/setup.ts has already loaded the shared
 * Stripe client, so its methods are replaced instead of using jest.mock.
 */
function mockStripe() {
    const createIntent = jest.spyOn(stripe.paymentIntents, 'create').mockImplementation(() => {
        createdIntents++
        return Promise.resolve({
            id: `pi_test_${createdIntents}`,
            client_secret: `pi_test_${createdIntents}_secret`,
        } as never)
    })
    const cancelIntent = jest.spyOn(stripe.paymentIntents, 'cancel').mockResolvedValue({} as never)
    // A succeeded intent, with the fee of its charge expanded as the webhook asks for it.
    const retrieveIntent = jest.spyOn(stripe.paymentIntents, 'retrieve').mockResolvedValue({
        latest_charge: { balance_transaction: { fee: STRIPE_FEE } },
    } as never)

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

    return { transactionId: transaction.id, paymentId: transaction.payment.id, paymentIntentId }
}

const readTransaction = (id: number) => prisma.ledgerTransaction.findUniqueOrThrow({
    where: { id },
    include: { payment: true },
})

/**
 * A SUCCEEDED transfer with no payment, the shape reverseTransaction reverses in production.
 * `fromAccountId` must already hold at least `funds`.
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

    test('cancelOwn cancels a pending deposit the same way', async () => {
        const account = await createAccount('stripecancelown')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        await ledgerTransactionOperations.cancelOwn({
            params: { id: transactionId },
            session: Session.fromJsObject({
                user: { id: account.ownership.userId! } as NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>,
                permissions: ['LEDGER_ADMIN'],
                memberships: [],
            }),
        })

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

describe('canceling a transaction', () => {
    const sessionOf = (userId: number, permissions: Permission[]) => Session.fromJsObject({
        user: { id: userId } as NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>,
        permissions,
        memberships: [],
    })

    test('only an admin can cancel, since the ledger sweeper cancels abandoned attempts', async () => {
        const account = await createAccount('cancelauthdepositor')
        const { transactionId } = await startStripeDeposit(account.id)

        await expect(ledgerTransactionOperations.cancel({
            params: { id: transactionId },
            session: sessionOf(account.ownership.userId!, ['LEDGER_USE']),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))

        await expect(ledgerTransactionOperations.cancel({
            params: { id: transactionId },
            session: sessionOf(account.ownership.userId!, ['LEDGER_ADMIN']),
        })).resolves.toMatchObject({ state: 'CANCELED' })
    })
})

describe('reading the state of a payment\'s transaction', () => {
    const sessionOf = (userId: number) => Session.fromJsObject({
        user: { id: userId } as NonNullable<Parameters<typeof Session.fromJsObject>[0]['user']>,
        permissions: [],
        memberships: [],
    })

    test('the payer sees the transaction go from PENDING to SUCCEEDED once the webhook settles it', async () => {
        const account = await createAccount('statebypaymentpayer')
        const { paymentId, paymentIntentId } = await startStripeDeposit(account.id)
        const session = sessionOf(account.ownership.userId!)

        await expect(ledgerTransactionOperations.readStateByPayment({ params: { paymentId }, session }))
            .resolves.toBe('PENDING')

        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        await expect(ledgerTransactionOperations.readStateByPayment({ params: { paymentId }, session }))
            .resolves.toBe('SUCCEEDED')
    })

    test('someone who is not party to the transaction cannot read it', async () => {
        const account = await createAccount('statebypaymentowner')
        const stranger = await createAccount('statebypaymentstranger')
        const { paymentId } = await startStripeDeposit(account.id)

        await expect(ledgerTransactionOperations.readStateByPayment({
            params: { paymentId },
            session: sessionOf(stranger.ownership.userId!),
        })).rejects.toThrow(new Smorekopp('UNAUTHORIZED'))
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

    test('a succeeded event whose fee is not known yet is retried instead of recorded', async () => {
        const account = await createAccount('stripenofeeyet')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)
        stripeMocks.retrieveIntent.mockResolvedValueOnce({ latest_charge: { balance_transaction: null } } as never)

        await expect(stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId)))
            .rejects.toThrow('no balance transaction')

        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'PENDING',
            payment: { state: 'PROCESSING', fees: null },
        })
        expect(await balanceOf(account.id)).toEqual({ amount: 0, fees: 0 })
    })

    test('a succeeded event delivered twice only credits the account once, with no false alarm', async () => {
        const account = await createAccount('stripeduplicate')
        const { paymentIntentId } = await startStripeDeposit(account.id)
        const errorSpy = jest.spyOn(logger, 'error')

        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))
        errorSpy.mockClear()
        const response = await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
        expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('MANUAL ADMIN ACTION REQUIRED'))
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

    test('a failure whose intent already succeeded on Stripe is ignored rather than marked FAILED', async () => {
        const account = await createAccount('stripefailedraced')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)
        stripeMocks.cancelIntent.mockRejectedValueOnce(
            new Stripe.errors.StripeInvalidRequestError({ type: 'invalid_request_error' })
        )
        stripeMocks.retrieveIntent.mockResolvedValueOnce({ status: 'succeeded' } as never)

        const response = await stripeWebhookCallback(stripeEvent('payment_intent.payment_failed', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'PENDING',
            payment: { state: 'PROCESSING' },
        })
    })

    test('a failure whose intent Stripe already canceled on an earlier delivery still fails locally', async () => {
        const account = await createAccount('stripefailedcanceled')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)
        stripeMocks.cancelIntent.mockRejectedValueOnce(
            new Stripe.errors.StripeInvalidRequestError({ type: 'invalid_request_error' })
        )
        stripeMocks.retrieveIntent.mockResolvedValueOnce({ status: 'canceled' } as never)

        const response = await stripeWebhookCallback(stripeEvent('payment_intent.payment_failed', paymentIntentId))

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'FAILED',
            payment: { state: 'FAILED' },
        })
    })

    test('the cancel call carries no fixed idempotency key, so a transient failure can be retried', async () => {
        const account = await createAccount('stripefailedretry')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)
        stripeMocks.cancelIntent.mockRejectedValueOnce(new Error('Stripe is down'))

        await expect(stripeWebhookCallback(stripeEvent('payment_intent.payment_failed', paymentIntentId)))
            .rejects.toThrow('Stripe is down')

        // No options object, so no idempotencyKey - a fixed one would make Stripe replay this
        // exact failure on every retry instead of actually trying again.
        expect(stripeMocks.cancelIntent.mock.calls[0][1]).toBeUndefined()
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'PENDING',
            payment: { state: 'PROCESSING' },
        })
    })

    test('a dispute flags the payment for manual review instead of being silently dropped', async () => {
        const account = await createAccount('stripedispute')
        const { transactionId, paymentId, paymentIntentId } = await startStripeDeposit(account.id)
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        const disputeEvent = {
            type: 'charge.dispute.created',
            data: { object: { id: 'ch_test', payment_intent: paymentIntentId } },
        } as unknown as Stripe.Event

        const response = await stripeWebhookCallback(disputeEvent)

        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({ state: 'SUCCEEDED' })
        expect(await prisma.manualTransactionReview.findFirst({ where: { paymentId } })).toMatchObject({
            state: 'OPEN',
            problem: 'STRIPE_DISPUTE',
            problemDescription: expect.stringContaining(paymentIntentId),
            transactionId: null,
        })
    })

    test('a refund on Stripe flags the payment with the amount refunded', async () => {
        const account = await createAccount('striperefund')
        const { paymentId, paymentIntentId } = await startStripeDeposit(account.id)
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        await stripeWebhookCallback({
            type: 'charge.refunded',
            data: { object: { id: 'ch_test', payment_intent: paymentIntentId, amount_refunded: 25_00 } },
        } as unknown as Stripe.Event)

        expect(await prisma.manualTransactionReview.findFirst({ where: { paymentId } })).toMatchObject({
            problem: 'STRIPE_REFUND',
            problemDescription: expect.stringContaining('25.00'),
        })
    })

    test('a dispute on a payment intent no payment here has still becomes a review', async () => {
        await stripeWebhookCallback({
            type: 'charge.dispute.created',
            data: { object: { id: 'dp_test', payment_intent: 'pi_unknown_dispute' } },
        } as unknown as Stripe.Event)

        expect(await prisma.manualTransactionReview.findFirst({
            where: { problemDescription: { contains: 'pi_unknown_dispute' } },
        })).toMatchObject({ problem: 'STRIPE_DISPUTE', transactionId: null, paymentId: null })
    })

    test('a success for a payment intent no payment here has becomes a review', async () => {
        const response = await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', 'pi_unknown_success'))

        expect(response.status).toBe(200)
        expect(await prisma.manualTransactionReview.findFirst({
            where: { problemDescription: { contains: 'pi_unknown_success' } },
        })).toMatchObject({ problem: 'UNCLAIMED_PAYMENT', transactionId: null, paymentId: null })
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

        // In a transaction like every real caller, so a duplicate's correction rolls back when
        // its Refund row fails.
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
                refundTo: payer.id,
            },
            bypassAuth: true,
        })

        expect(await balanceOf(committee.id)).toEqual({ amount: 0, fees: 0 })
        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
    })

    test('after a mixed payment, the payer gets back both their balance part and the rest', async () => {
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
                refundTo: payer.id,
            },
            bypassAuth: true,
        })

        // The flipped 40 from the payer's own balance plus the 60 that came in from outside.
        expect(await balanceOf(payer.id)).toEqual({ amount: DEPOSIT, fees: 0 })
        expect(await balanceOf(committee.id)).toEqual({ amount: 0, fees: 0 })
    })
})

describe('resolving a manual review', () => {
    test('a resolved review carries the given description and drops off the needing-attention list', async () => {
        const account = await createAccount('resolvereview')
        const { paymentId, paymentIntentId } = await startStripeDeposit(account.id)
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        const disputeEvent = {
            type: 'charge.dispute.created',
            data: { object: { id: 'ch_test', payment_intent: paymentIntentId } },
        } as unknown as Stripe.Event
        await stripeWebhookCallback(disputeEvent)

        const review = await prisma.manualTransactionReview.findFirstOrThrow({ where: { paymentId } })
        expect((await manualReviewOperations.readOpen({ bypassAuth: true }))
            .some(open => open.id === review.id)).toBe(true)

        const resolved = await manualReviewOperations.resolve({
            params: { reviewId: review.id },
            data: { resolutionDescription: 'Avvist hos Stripe, ingen handling nødvendig.' },
            bypassAuth: true,
        })

        expect(resolved).toMatchObject({
            state: 'RESOLVED',
            resolutionDescription: 'Avvist hos Stripe, ingen handling nødvendig.',
        })
        expect((await manualReviewOperations.readOpen({ bypassAuth: true }))
            .some(open => open.id === review.id)).toBe(false)
    })

    test('an already-resolved review cannot be resolved again', async () => {
        const account = await createAccount('resolvereviewtwice')
        const { paymentId, paymentIntentId } = await startStripeDeposit(account.id)
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        const disputeEvent = {
            type: 'charge.dispute.created',
            data: { object: { id: 'ch_test', payment_intent: paymentIntentId } },
        } as unknown as Stripe.Event
        await stripeWebhookCallback(disputeEvent)

        const review = await prisma.manualTransactionReview.findFirstOrThrow({ where: { paymentId } })
        await manualReviewOperations.resolve({
            params: { reviewId: review.id },
            data: { resolutionDescription: 'first' },
            bypassAuth: true,
        })

        await expect(manualReviewOperations.resolve({
            params: { reviewId: review.id },
            data: { resolutionDescription: 'second' },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })

    test('two admins resolving the same review at once never both succeed', async () => {
        const account = await createAccount('resolvereviewconcurrent')
        const { paymentId, paymentIntentId } = await startStripeDeposit(account.id)
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        const disputeEvent = {
            type: 'charge.dispute.created',
            data: { object: { id: 'ch_test', payment_intent: paymentIntentId } },
        } as unknown as Stripe.Event
        await stripeWebhookCallback(disputeEvent)
        const review = await prisma.manualTransactionReview.findFirstOrThrow({ where: { paymentId } })

        const resolve = (resolutionDescription: string) => manualReviewOperations.resolve({
            params: { reviewId: review.id },
            data: { resolutionDescription },
            bypassAuth: true,
        })
        const results = await Promise.allSettled([resolve('first admin'), resolve('second admin')])

        // Exactly one of the two wins - a plain read-then-write would let both pass the read and
        // the second silently overwrite the first's resolutionDescription instead of failing.
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
        expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)

        const resolved = await prisma.manualTransactionReview.findUniqueOrThrow({ where: { id: review.id } })
        expect(['first admin', 'second admin']).toContain(resolved.resolutionDescription)
    })
})

describe('reimbursing an unapplied payment', () => {
    test('a late Stripe success after a local cancel is reimbursed to the payer', async () => {
        const account = await createAccount('reimburselate')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)
        const paymentCountBefore = await prisma.payment.count()

        await ledgerTransactionOperations.cancel({ params: { id: transactionId }, bypassAuth: true })
        // Stripe's own cancel call is mocked, so despite our side canceling, the intent still
        // reports success, which is the exact race this reimbursement path exists for.
        const response = await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))

        // The webhook only records the success. Crediting the payer is the ledger sweeper's job.
        expect(response.status).toBe(200)
        expect(await readTransaction(transactionId)).toMatchObject({
            state: 'CANCELED',
            payment: { state: 'SUCCEEDED', fees: STRIPE_FEE, claimedByTransactionId: null },
        })
        expect(await balanceOf(account.id)).toEqual({ amount: 0, fees: 0 })

        await reimburseUnclaimedPayments()

        expect(await readTransaction(transactionId)).toMatchObject({ state: 'CANCELED' })
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })

        const refund = await prisma.refund.findUnique({ where: { originalTransactionId: transactionId } })
        expect(refund).toMatchObject({ type: 'REIMBURSEMENT' })

        // No new Payment row was fabricated. The reimbursement reuses the original Stripe
        // payment directly, which is also now the one that claimed it.
        expect(await prisma.payment.count()).toBe(paymentCountBefore)
        const refundTransaction = await prisma.ledgerTransaction.findUniqueOrThrow({
            where: { id: refund!.refundTransactionId },
            select: { paymentId: true },
        })
        const original = await prisma.ledgerTransaction.findUniqueOrThrow({
            where: { id: transactionId },
            select: { paymentId: true, payment: { select: { claimedByTransactionId: true } } },
        })
        expect(refundTransaction.paymentId).toBe(original.paymentId)
        expect(original.payment?.claimedByTransactionId).toBe(refund!.refundTransactionId)
    })

    test('a webhook retry or another sweep for an already-reimbursed intent does nothing further', async () => {
        const account = await createAccount('reimbursetwice')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        await ledgerTransactionOperations.cancel({ params: { id: transactionId }, bypassAuth: true })
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))
        await reimburseUnclaimedPayments()
        await stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId))
        await reimburseUnclaimedPayments()

        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
        expect(await prisma.refund.count({ where: { originalTransactionId: transactionId } })).toBe(1)
    })

    test('a SUCCEEDED transaction cannot be reimbursed this way - use reverseTransaction instead', async () => {
        const account = await createAccount('reimbursenothing')
        const transaction = await createSucceededDeposit(account.id, DEPOSIT)

        await expect(refundOperations.reimburseUnappliedPayment({
            params: { originalTransactionId: transaction.id, reason: 'nothing to reimburse' },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))
    })
})

describe('a payment can only be claimed by one succeeding transaction', () => {
    test('a second transaction against an already-claimed payment fails instead of succeeding', async () => {
        const account = await createAccount('paymentclaim')
        const payment = await paymentOperations.create({
            params: { provider: 'MANUAL', funds: DEPOSIT, manualFees: 0 },
            bypassAuth: true,
        })

        const first = await ledgerTransactionOperations.create({
            params: {
                purpose: 'DEPOSIT',
                ledgerEntries: [{ ledgerAccountId: account.id, funds: DEPOSIT }],
                paymentId: payment.id,
            },
            bypassAuth: true,
        })
        expect(first.state).toBe('SUCCEEDED')

        await expect(ledgerTransactionOperations.create({
            params: {
                purpose: 'DEPOSIT',
                ledgerEntries: [{ ledgerAccountId: account.id, funds: DEPOSIT }],
                paymentId: payment.id,
            },
            bypassAuth: true,
        })).rejects.toThrow(new Smorekopp('BAD PARAMETERS'))

        expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
            .toMatchObject({ claimedByTransactionId: first.id })
        // Only the first transaction's deposit ever actually applied.
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: 0 })
    })

    test('two concurrent deliveries of the same succeeded webhook never end the transaction FAILED', async () => {
        const account = await createAccount('claimconcurrent')
        const { transactionId, paymentIntentId } = await startStripeDeposit(account.id)

        const responses = await Promise.all([
            stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId)),
            stripeWebhookCallback(stripeEvent('payment_intent.succeeded', paymentIntentId)),
        ])

        responses.forEach(response => expect(response.status).toBe(200))
        expect(await readTransaction(transactionId)).toMatchObject({ state: 'SUCCEEDED' })
        expect(await balanceOf(account.id)).toEqual({ amount: DEPOSIT, fees: STRIPE_FEE })
    })
})

describe('backfilling claimedByTransactionId', () => {
    // Mirrors the UPDATE in the add_manual_review_and_payment_claim migration directly, since the
    // migration itself only ever runs once, against data that predates this test environment.
    const runBackfill = () => prisma.$executeRaw`
        UPDATE "Payment" AS p
        SET "claimedByTransactionId" = t."id"
        FROM "LedgerTransaction" AS t
        WHERE t."paymentId" = p."id"
          AND t."state" = 'SUCCEEDED'
    `

    test('a payment already backing a succeeded transaction is claimed by the backfill', async () => {
        const account = await createAccount('backfillclaimed')
        const transaction = await createSucceededDeposit(account.id, DEPOSIT)

        // Simulate a payment that predates the claim column - advance() already claimed it
        // through the normal flow above, which the backfill is meant to redo for rows where that
        // never happened.
        await prisma.payment.update({
            where: { id: transaction.payment!.id },
            data: { claimedByTransactionId: null },
        })

        await runBackfill()

        expect(await prisma.payment.findUniqueOrThrow({ where: { id: transaction.payment!.id } }))
            .toMatchObject({ claimedByTransactionId: transaction.id })
    })

    test('a payment with no succeeded transaction is left unclaimed by the backfill', async () => {
        const payment = await paymentOperations.create({
            params: { provider: 'MANUAL', funds: DEPOSIT, manualFees: 0 },
            bypassAuth: true,
        })

        await runBackfill()

        expect(await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
            .toMatchObject({ claimedByTransactionId: null })
    })
})

describe("advance()'s balance check sees debits regardless of transaction id order", () => {
    test('a transaction is not fooled by a higher-id competing debit into overcommitting the account', async () => {
        const account = await createAccount('balanceordering')
        const sink = await createAccount('balanceorderingsink')
        await createSucceededDeposit(account.id, DEPOSIT)

        // Inserted as PENDING directly, skipping create()'s pre-check, to simulate two concurrent
        // requests that advance()'s account lock must resolve.
        const transfer = (funds: number) => prisma.ledgerTransaction.create({
            data: {
                purpose: 'CABIN_BOOKING',
                state: 'PENDING',
                ledgerEntries: {
                    create: [
                        { ledgerAccountId: sink.id, funds, fees: 0 },
                        { ledgerAccountId: account.id, funds: -funds, fees: 0 },
                    ],
                },
            },
        })
        const low = await transfer(DEPOSIT * 0.7)
        await transfer(DEPOSIT * 0.5)

        const resolved = await ledgerTransactionOperations.advance({ params: { id: low.id }, bypassAuth: true })

        // Combined, the two debits (0.7 + 0.5 of the deposit) exceed the account's balance - a
        // check blind to the higher-id one would see only its own 0.7 against the full deposit
        // and wrongly let this lower-id transaction succeed too.
        expect(resolved.state).toBe('FAILED')
    })
})
