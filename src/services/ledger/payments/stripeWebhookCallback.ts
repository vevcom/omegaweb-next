import logger from '@/lib/logger'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/prisma/client'
import { ledgerTransactionOperations } from '@/services/ledger/transactions/operations'
import { refundOperations } from '@/services/ledger/refunds/operations'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type Stripe from 'stripe'
import type { PaymentState } from '@/prisma-generated-pn-types'

/**
 * Utility function to retrieve the Stripe fees for a given payment intent.
 */
export async function retrieveStripeFees(paymentIntent: Stripe.PaymentIntent): Promise<number> {
    let totalFees = 0

    // for await pages through all results automatically, so this sums fees across every
    // charge, not just the first page (Stripe defaults to 10 per page).
    for await (const charge of stripe.charges.list({
        payment_intent: paymentIntent.id,
    })) {
        if (!charge.balance_transaction) {
            logger.error(`Charge does not have a balance transaction: ${charge.id}`)
            continue
        }

        const balanceTransaction = typeof charge.balance_transaction === 'string'
            ? await stripe.balanceTransactions.retrieve(charge.balance_transaction)
            : charge.balance_transaction

        totalFees += balanceTransaction.fee
    }

    return totalFees
}

// Map between Stripe event types and our internal payment states.
const EVENT_TYPE_TO_STATE: Partial<Record<Stripe.Event['type'], PaymentState>> = {
    'payment_intent.canceled': 'CANCELED',
    'payment_intent.succeeded': 'SUCCEEDED',
    'payment_intent.payment_failed': 'FAILED',
}

/**
 * Calls `refundOperations.reimburseUnappliedPayment`, logging rather than throwing on failure.
 * Any failure here means Stripe genuinely holds money that nothing will ever credit back on its
 * own, so it always needs a human regardless of why the call failed.
 */
async function reimburseOrLogManualAction(
    originalTransactionId: number,
    reason: string,
    fees?: number,
) {
    try {
        await refundOperations.reimburseUnappliedPayment({
            params: { originalTransactionId, reason, fees },
            bypassAuth: true,
        })
    } catch (error) {
        logger.error(
            `MANUAL ADMIN ACTION REQUIRED! Could not reimburse ledger transaction ${originalTransactionId}.`,
            { error }
        )
    }
}

/**
 * Reimburses the payer when a Stripe payment intent succeeded but the local payment had already
 * moved to a terminal state that can't accept a success, which the catch block below handles as
 * a Prisma P2025 error. Neither side of the original transaction ever applied to anyone's ledger
 * balance, even though Stripe genuinely took the money. Idempotent: a webhook retry for the same
 * payment intent finds the payment already claimed and does nothing further.
 */
async function refundLateStripeSuccess(paymentIntentId: string, fee?: number) {
    const stripePayment = await prisma.stripePayment.findUnique({
        where: { paymentIntentId },
        select: {
            payment: {
                select: {
                    claimedByTransactionId: true,
                    ledgerTransactions: { select: { id: true }, orderBy: { id: 'asc' }, take: 1 },
                },
            },
        },
    })

    const originalTransaction = stripePayment?.payment?.ledgerTransactions[0]
    if (!stripePayment?.payment || !originalTransaction) {
        logger.error(
            'MANUAL ADMIN ACTION REQUIRED! Could not find a transaction to reimburse for '
            + `late-succeeding payment intent ${paymentIntentId}.`
        )
        return
    }
    if (stripePayment.payment.claimedByTransactionId !== null) return

    await reimburseOrLogManualAction(
        originalTransaction.id,
        'Stripe-betalingen gikk gjennom etter at den lokalt var kansellert eller mislyktes.',
        fee
    )
}

/**
 * The function which is called when we receive a payment intent event from Stripe.
 * It expects that the fields `latest_charge.balance_transaction` are expanded.
 * (This is configured in the Stripe dashboard.)
 *
 * @warning This callback assumes that the Stripe payment intents always have the capture method "automatic".
 * If this ever changes this function needs to be changed to handle uncaptured payments.
 * (That is payments which are authorized, but we have not actually taken the money yet.)
 *
 * This is not implemented using `ServiceMethod` because it does not need any of its features.
 * Firstly, the webhook callback is not part of the interface of the payment service.
 * This function will only ever be used one place. Secondly, authentication and data validation
 * is already handled by the Stripe package.
 *
 * @param paymentIntent The payment intent object received in the webhook.
 * It is expected that `latest_charge.balance_transaction` is expanded.
 *
 * @returns An appropriate `Response`.
 */
export async function stripeWebhookCallback(event: Stripe.Event): Promise<Response> {
    const paymentState = EVENT_TYPE_TO_STATE[event.type]

    if (!paymentState) {
        // We return a 200 response even for unsupported event
        // types to avoid unecessary retries from Stripe.
        logger.error(`Received unsupported Stripe event type: ${event.type}`)
        return new Response('', { status: 200 })
    }

    // TypeScript cannot figure out that the above if statement narrows the possible event type
    // so we'll have to assert this our selves
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    // Declare fee, it will be undefined by default
    // which is what we want for the canceled and failed events
    let fee: number | undefined

    // If the payment succeeded we'll extract the fee
    if (event.type === 'payment_intent.succeeded') {
        fee = await retrieveStripeFees(paymentIntent)
    }

    // Update the db model with the updated values.
    let stripePayment
    try {
        stripePayment = await prisma.stripePayment.update({
            where: {
                paymentIntentId: paymentIntent.id,
                payment: {
                    state: {
                        // Guard against changing final state
                        // This should never happen, but you can never be too careful
                        in: ['PENDING', 'PROCESSING', paymentState]
                    },
                },
            },
            data: {
                payment: {
                    update: {
                        fees: fee,
                        state: paymentState,
                    },
                }
            },
            select: {
                payment: {
                    select: {
                        id: true,
                        // There's at most one PENDING transaction on a payment at this point in
                        // the flow, since a reimbursement referencing the same payment is only
                        // ever created later, in response to this very update's outcome.
                        ledgerTransactions: {
                            where: { state: 'PENDING' },
                            select: { id: true },
                            take: 1,
                        },
                    },
                },
            },
        })
    } catch (err) {
        // A P2025 here means the payment is already in a final state that conflicts with this
        // event, for example a stale or duplicate webhook delivered out of order. Log and stop
        // instead of throwing, which would make Stripe retry an event that can never succeed.
        if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
            logger.error(
                `Ignoring Stripe event for payment intent ${paymentIntent.id}: `
                + `payment is already in a state which conflicts with "${paymentState}".`
            )
            // Stripe genuinely captured the money even though our side had already moved on,
            // most likely because we canceled the payment locally moments before Stripe's
            // success event arrived. Nobody's ledger balance reflects a CANCELED or FAILED
            // transaction's entries, so credit the payer back.
            if (paymentState === 'SUCCEEDED') {
                await refundLateStripeSuccess(paymentIntent.id, fee)
            }
            return new Response('', { status: 200 })
        }

        throw err
    }

    const pendingTransaction = stripePayment.payment.ledgerTransactions[0]
    if (pendingTransaction) {
        // No user session exists here. Stripe's signature verification, already checked by the
        // route handler, is what authorizes this call.
        const transaction = await ledgerTransactionOperations.advance({
            params: {
                id: pendingTransaction.id,
            },
            bypassAuth: true,
        })

        // The payment just succeeded, but the transaction still ended up FAILED here, most
        // commonly because an account involved was frozen after this very webhook arrived. The
        // failed entries never applied to anyone's balance, so reimburse the payer the same way
        // refundLateStripeSuccess does above.
        if (transaction.state === 'FAILED' && transaction.payment?.state === 'SUCCEEDED') {
            await reimburseOrLogManualAction(
                transaction.id,
                transaction.reason ?? 'Transaksjonen mislyktes etter at betalingen var gjennomført.'
            )
        }
    } else {
        logger.error(
            'MANUAL ADMIN ACTION REQUIRED! Stripe payment has no pending ledger transaction to advance: '
            + `${stripePayment.payment.id}`
        )
    }

    // We only allow one payment attempt per payment intent.
    // If this failed we cancel the payment intent to make sure it cannot be used in the future.
    //
    // A failure here is left to throw on purpose. If the cancel does not go through, the
    // payment intent could still be paid later, but the payment is already marked FAILED, a
    // state the success handler above refuses to leave. Throwing makes Stripe retry the event
    // until the cancel actually succeeds.
    if (event.type === 'payment_intent.payment_failed') {
        await stripe.paymentIntents.cancel(
            paymentIntent.id,
            {},
            { idempotencyKey: `project-next-payment-id-${paymentIntent.id}` },
        )
    }

    return new Response('', { status: 200 })
}
